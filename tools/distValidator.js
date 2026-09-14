#!/usr/bin/env node

/*
 * Validates a freshly built dist/ before it is deployed.
 *
 * Usage: node tools/distValidator.js <testnet|mainnet>
 *
 * vue.config.js assembles dist/ from four HtmlWebpackPlugin pages, a CopyWebpackPlugin that lifts
 * files straight out of node_modules, and a `config` alias that decides which network the bundle
 * talks to. Each of those fails quietly: a page that stopped being emitted, an unsubstituted
 * template expression, a `domain` that came out `undefined` because VUE_APP_HUB_URL was not set,
 * or a bundle built against the wrong config all produce a dist/ that looks fine and misbehaves in
 * the browser. This checks the invariants the build never asserts for itself.
 *
 * The extension allowlist additionally guards the deployment: .github/scripts/s3-sync.sh uploads
 * dist/ in one pass per content type, so a dependency bump that introduces an unknown file
 * extension must fail here rather than land in S3 with a guessed type. The origin sends `nosniff`,
 * which makes a wrong content type a hard failure in the browser, not a cosmetic one. Failing here
 * is also the only cheap place to fail: s3-sync.sh cannot notice until after it has uploaded.
 */

const fs = require('fs');
const path = require('path');

const DIST = 'dist';

const BUILD = process.argv[2];

/**
 * The origin each deployable build bakes into its pages, mirroring the `domain` ternary in
 * vue.config.js. Testnet's is not read from an environment variable here on purpose: the testnet
 * Hub is hub.nimiq-testnet.com -- that is the origin config.testnet.ts lists among its
 * privilegedOrigins -- so a build carrying anything else is a build that will not work there,
 * whatever VUE_APP_HUB_URL happened to say.
 */
const EXPECTED_ORIGIN = {
    mainnet: 'https://hub.nimiq.com',
    testnet: 'https://hub.nimiq-testnet.com',
};

/** Files that must exist and be non-empty, whatever else the build produced. */
const REQUIRED_FILES = [
    `${DIST}/index.html`,
    // The embeddable endpoint. The CloudFront response-headers policy is keyed on this exact path,
    // so its absence would silently drop the frame-ancestors policy rather than 404 visibly.
    `${DIST}/iframe.html`,
    `${DIST}/cashlink/index.html`,
    `${DIST}/export.html`,
    `${DIST}/browser-warning.js`,
    `${DIST}/blocking.css`,
    `${DIST}/favicon.ico`,
    `${DIST}/ServiceWorker.js`,
    `${DIST}/checkout-demo.mp4`,
    // index.html imports these as a module; they are copied in, not bundled, so webpack never
    // reports them missing.
    `${DIST}/nimiq/web/index.js`,
    `${DIST}/nimiq/web/main-wasm/index_bg.wasm`,
];

/** vue.config.js adds the demo pages for local and testnet builds only. */
const TESTNET_ONLY_FILES = [`${DIST}/demos.html`, `${DIST}/callback.html`];

/** Pages whose bundles webpack injects, and therefore pins with an SRI hash. */
const SRI_PAGES = [
    `${DIST}/index.html`,
    `${DIST}/iframe.html`,
    `${DIST}/cashlink/index.html`,
    `${DIST}/export.html`,
];

/** Extensions s3-sync.sh has an upload rule for. */
const ALLOWED_EXTENSIONS = new Set([
    'css', 'gitkeep', 'html', 'ico', 'js', 'json', 'map', 'md', 'mjs', 'mp4', 'png', 'svg', 'ts',
    'wasm',
]);

/** Files that legitimately carry no extension at all. */
const ALLOWED_EXTENSIONLESS = new Set(['LICENSE']);

let hasErrors = false;

/**
 * @param {string} message
 */
function fail(message) {
    hasErrors = true;
    console.error('\x1b[31m%s\x1b[0m', `ERROR: ${message}`);
}

/**
 * @param {string} message
 */
function ok(message) {
    console.log('\x1b[32m%s\x1b[0m', `OK: ${message}`);
}

/**
 * Every file below a directory, recursively.
 *
 * @param {string} dirPath
 * @returns {string[]}
 */
function find(dirPath) {
    /** @type {string[]} */
    let results = [];

    for (const entry of fs.readdirSync(dirPath)) {
        const filePath = path.join(dirPath, entry);
        if (fs.lstatSync(filePath).isDirectory()) {
            results = results.concat(find(filePath));
        } else {
            results.push(filePath);
        }
    }

    return results;
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isNonEmptyFile(filePath) {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 0;
}

/**
 * Every file the build promises, present and non-empty.
 *
 * @param {string} build
 */
function checkRequiredFiles(build) {
    const required = [...REQUIRED_FILES, ...(build === 'testnet' ? TESTNET_ONLY_FILES : [])];
    const missing = required.filter(filePath => !isNonEmptyFile(filePath));

    if (missing.length) {
        missing.forEach(filePath => fail(`missing or empty: ${filePath}`));
    } else {
        ok(`all ${required.length} required files present`);
    }
}

/**
 * The substitutions vue.config.js performs into the page templates. A survivor of any of these is
 * a page that renders a literal template expression, or links a favicon at `undefined/favicon.ico`
 * because VUE_APP_HUB_URL was unset when a testnet build ran.
 *
 * @param {string} build
 */
function checkPageRewrites(build) {
    const expectedOrigin = EXPECTED_ORIGIN[build];

    SRI_PAGES.filter(isNonEmptyFile).forEach(filePath => {
        const html = fs.readFileSync(filePath, 'utf8');

        if (html.includes('<%=')) fail(`unsubstituted template expression in ${filePath}`);
        if (html.includes('undefined/')) fail(`'undefined/' in ${filePath}: the build had no domain to substitute`);

        // Only index.html and cashlink/index.html are given `domain`; the other two never
        // reference it.
        const declared = html.match(/<meta\s+name="url"\s+content="([^"]*)"/i)
            || html.match(/<link\s+rel="icon"\s+href="([^"]*)\/favicon\.ico"/i);
        if (declared && declared[1] !== expectedOrigin) {
            fail(`${filePath} was built for '${declared[1]}', but a ${build} build serves ${expectedOrigin}`);
        }

        if (!/\sintegrity\s*=\s*"/i.test(html)) {
            fail(`no SRI hashes in ${filePath}: vue.config.js's \`integrity\` option did not apply`);
        }
    });

    if (!hasErrors) ok(`pages rewritten for ${expectedOrigin}`);
}

/**
 * The `config` alias in vue.config.js decides which network the Hub talks to, and nothing about a
 * built bundle says which one it got. Assert that the requested config -- and only that config --
 * made it in, so a mainnet build can never be deployed to testnet or the reverse.
 *
 * @param {string} build
 */
function checkConfig(build) {
    /**
     * @param {string} name
     * @returns {string|null}
     */
    const keyguardEndpoint = name => {
        const configPath = `src/config/config.${name}.ts`;
        if (!fs.existsSync(configPath)) return null;
        const match = fs.readFileSync(configPath, 'utf8').match(/keyguardEndpoint:\s*'([^']+)'/);
        return match ? match[1] : null;
    };

    const expected = keyguardEndpoint(build);
    if (!expected) {
        fail(`could not read keyguardEndpoint out of src/config/config.${build}.ts`);
        return;
    }

    // chunk-vendors is exempt: @nimiq/keyguard-client ships 'https://keyguard.nimiq.com' as its
    // own default endpoint, so a mainnet origin appearing there says nothing about which config
    // this build used. The app chunks are where the `config` alias resolves.
    const appBundles = find(`${DIST}/js`)
        .filter(filePath => filePath.endsWith('.js') && !path.basename(filePath).startsWith('chunk-vendors'))
        .map(filePath => fs.readFileSync(filePath, 'utf8'));

    if (!appBundles.some(bundle => bundle.includes(expected))) {
        fail(`${build} keyguardEndpoint (${expected}) is in none of the app bundles`);
        return;
    }

    const foreign = fs.readdirSync('src/config')
        .map(entry => (entry.match(/^config\.(.+)\.ts$/) || [])[1])
        .filter(name => name && name !== build && name !== 'local')
        .map(keyguardEndpoint)
        .filter(endpoint => endpoint && endpoint !== expected
            && appBundles.some(bundle => bundle.includes(endpoint)));

    if (foreign.length) {
        fail(`app bundles built for ${build} also contain foreign endpoint(s): ${foreign.join(', ')}`);
        return;
    }

    ok(`app bundles carry the ${build} config (${expected})`);
}

/**
 * Every file in dist/ must be covered by one of s3-sync.sh's typed upload passes.
 *
 * @param {string[]} files
 */
function checkFileTypes(files) {
    /** @type {Map<string, string[]>} */
    const unhandled = new Map();

    files.forEach(filePath => {
        const base = path.basename(filePath);
        if (ALLOWED_EXTENSIONLESS.has(base)) return;

        // Deliberately not path.extname(), which reports '' for dotfiles such as .gitkeep.
        const dot = base.lastIndexOf('.');
        const extension = dot === -1 ? '<none>' : base.slice(dot + 1);
        if (extension !== '<none>' && ALLOWED_EXTENSIONS.has(extension)) return;

        const seen = unhandled.get(extension) || [];
        seen.push(filePath);
        unhandled.set(extension, seen);
    });

    unhandled.forEach((paths, extension) => {
        const label = extension === '<none>' ? 'no file extension' : `unhandled extension .${extension}`;
        fail(`${label}, no upload rule in s3-sync.sh: ${paths.slice(0, 5).join(', ')}`
            + `${paths.length > 5 ? ` (and ${paths.length - 5} more)` : ''}`);
    });

    if (!unhandled.size) ok(`all ${files.length} files covered by an upload rule`);
}

if (!BUILD || !EXPECTED_ORIGIN[BUILD]) {
    console.error('\x1b[31m%s\x1b[0m', 'ERROR: usage: node tools/distValidator.js <testnet|mainnet>');
    process.exit(1);
}

if (!fs.existsSync(DIST)) {
    console.error('\x1b[31m%s\x1b[0m',
        `ERROR: ${DIST}/ was not created -- run \`build=${BUILD} yarn build\` first`);
    process.exit(1);
}

const distFiles = find(DIST);

checkRequiredFiles(BUILD);
checkPageRewrites(BUILD);
checkConfig(BUILD);
checkFileTypes(distFiles);

const totalBytes = distFiles.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);
console.log(`${DIST}/: ${distFiles.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB`);

if (hasErrors) process.exit(1);
