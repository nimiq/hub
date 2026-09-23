#!/usr/bin/env node

/*
 * Validates a deployed Hub over HTTP.
 *
 * Usage: node tools/deploymentValidator.js <base-url> [testnet|mainnet]
 *    or: DEPLOY_URL=https://... BUILD_CONFIG=testnet node tools/deploymentValidator.js
 *
 * Two things the Hub depends on cannot be asserted by anything in the build, because neither is
 * produced by the build:
 *
 *   1. The SPA fallback. src/router.ts runs in `history` mode, so `/checkout`, `/signup` and every
 *      other request path is a URL the browser really navigates to -- on the redirect flow, on a
 *      reload (RpcApi.ts keys off `location.pathname !== '/'` to stay put), and on the way back
 *      from the Keyguard. dist/ contains no such files: the server has to answer them with
 *      /index.html and a 200. That is the `try_files $uri $uri/ /index.html` in .gitlab-ci.yml's
 *      nginx config, and on CloudFront it is a viewer-request function. Get it wrong and every Hub
 *      request 404s while `/` still loads fine, which is exactly the failure a build-time check
 *      cannot see.
 *
 *   2. frame-ancestors. /iframe.html exists to be embedded and every other page exists not to be;
 *      the header that decides it is set by the CDN, not the document. src/iframe.ts hands
 *      `Config.privilegedOrigins` to its RpcServer, so those origins -- and only those -- are the
 *      ones that get anything out of framing the Hub. This reads that list straight out of
 *      src/config/config.<build>.ts and holds the deployment to it, which is what keeps the app
 *      config and the CloudFront policy from drifting apart.
 *
 * The policies themselves live in nimiq/IaC (lib/config.ts, the `hub` entry in `staticSites`).
 * Nothing in this repository fails when they drift. This does.
 *
 * It also re-derives every SRI hash from what the CDN actually serves, which catches a partial
 * upload: HTML pinning bundles that were never published, or published under a different encoding.
 */

const fs = require('fs');
const { createHash } = require('crypto');

const BASE = (process.argv[2] || process.env.DEPLOY_URL || '').replace(/\/+$/, '');
const BUILD = process.argv[3] || process.env.BUILD_CONFIG || 'testnet';

const TIMEOUT_MS = 30000;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

/**
 * A floor, not a count: it exists so that a scrape which silently matches nothing cannot pass as
 * "all hashes verified". `/` links 9 today -- browser-warning.js, two stylesheets, and the modern
 * and legacy variants of the three entry bundles.
 */
const MIN_SRI_RESOURCES = 6;

/** The IaC default, which the `hub` entry does not override. */
const HSTS = 'max-age=31536000; includeSubDomains; preload';

const JS = 'application/javascript';
const HTML = 'text/html';

/** The Hub is not a key store, but it is the origin the Keyguard's own iframe policy trusts. */
const NONE = ["'none'"];

/**
 * Drop `//` line comments, leaving string literals alone. Quote-aware rather than a regex, because
 * the strings this has to survive are origins: `.replace(/\/\/.*$/gm, '')` truncates
 * 'https://safe.nimiq-testnet.com' to 'https:' and turns the allowlist into nonsense.
 *
 * @param {string} source
 * @returns {string}
 */
function stripLineComments(source) {
    let out = '';
    /** @type {string|null} */
    let quote = null;

    for (let i = 0; i < source.length; i++) {
        const character = source[i];

        if (quote) {
            if (character === '\\') {
                out += character + (source[i + 1] || '');
                i += 1;
                continue;
            }
            if (character === quote) quote = null;
            out += character;
            continue;
        }

        if (character === "'" || character === '"' || character === '`') {
            quote = character;
            out += character;
            continue;
        }

        if (character === '/' && source[i + 1] === '/') {
            while (i < source.length && source[i] !== '\n') i += 1;
            out += '\n';
            continue;
        }

        out += character;
    }

    return out;
}

/**
 * The origins src/iframe.ts accepts RPC from, which are the only origins with a reason to frame
 * /iframe.html. Read from the config the deployment was built with rather than restated here, so
 * adding a privileged origin cannot quietly leave the CloudFront policy behind.
 *
 * @param {string} build
 * @returns {string[]}
 */
function privilegedOrigins(build) {
    const configPath = `src/config/config.${build}.ts`;
    if (!fs.existsSync(configPath)) throw new Error(`unknown build config '${build}': no ${configPath}`);

    const source = stripLineComments(fs.readFileSync(configPath, 'utf8'));

    const list = source.match(/privilegedOrigins\s*:\s*\[([^\]]*)\]/);
    if (!list) throw new Error(`could not read privilegedOrigins out of ${configPath}`);

    const origins = [...list[1].matchAll(/'([^']*)'/g)].map(match => match[1]);
    if (!origins.length) throw new Error(`privilegedOrigins in ${configPath} is empty`);

    // A parse that drifted produces plausible-looking garbage rather than an error, and this list
    // is an allowlist -- so refuse anything that is not an origin instead of asserting it as one.
    const malformed = origins.filter(origin => !/^https?:\/\/[^/\s]+$/.test(origin));
    if (malformed.length) {
        throw new Error(`privilegedOrigins in ${configPath} parsed as: ${JSON.stringify(malformed)}`);
    }

    return [...new Set(origins)];
}

/**
 * @typedef {object} Probe
 * @property {string} path
 * @property {string} contentType
 * @property {string[]} frameAncestors
 * @property {string} [title] - asserted for HTML, so a path cannot pass by serving the wrong page
 */

/**
 * @param {string} build
 * @param {string[]} privileged
 * @returns {Probe[]}
 */
function probesFor(build, privileged) {
    return [
        { path: '/', contentType: HTML, frameAncestors: NONE, title: 'Nimiq' },
        // The one embeddable page. Its policy is the whole reason this file exists.
        { path: '/iframe.html', contentType: HTML, frameAncestors: privileged, title: 'Nimiq Hub IFrame' },
        // A directory, so it only resolves if the edge rewrites `/cashlink/` to its index document
        // -- and it must resolve to the standalone Cashlink app, not to the SPA shell.
        { path: '/cashlink/', contentType: HTML, frameAncestors: NONE, title: 'Nimiq Cashlink' },
        { path: '/export.html', contentType: HTML, frameAncestors: NONE, title: 'Nimiq Hub Export' },
        { path: '/browser-warning.js', contentType: JS, frameAncestors: NONE },
        { path: '/ServiceWorker.js', contentType: JS, frameAncestors: NONE },
        { path: '/blocking.css', contentType: 'text/css', frameAncestors: NONE },
        { path: '/favicon.ico', contentType: 'image/x-icon', frameAncestors: NONE },
        // vue.config.js copies @nimiq/core in whole, and index.html imports it as a module.
        { path: '/nimiq/web/index.js', contentType: JS, frameAncestors: NONE },
        { path: '/nimiq/web/main-wasm/index_bg.wasm', contentType: 'application/wasm', frameAncestors: NONE },
        { path: '/img/cashlink-themes/generic.svg', contentType: 'image/svg+xml', frameAncestors: NONE },
        { path: '/checkout-demo.mp4', contentType: 'video/mp4', frameAncestors: NONE },
        { path: '/build-info.json', contentType: 'application/json', frameAncestors: NONE },
        // vue.config.js builds the demo pages for local and testnet only.
        ...(build === 'testnet' ? [
            { path: '/demos.html', contentType: HTML, frameAncestors: NONE, title: 'Nimiq Hub Demos' },
            { path: '/callback.html', contentType: HTML, frameAncestors: NONE },
        ] : []),
    ];
}

/**
 * Paths that exist only as routes in src/router.ts. Each one must come back as the SPA shell --
 * /index.html, HTTP 200 -- rather than as a 404, a redirect, or a directory index that is not
 * there. `/cashlink/create` and `/cashlink/manage` are in the list because they are the case where
 * the two rewrite rules meet: they are Hub routes that live under the standalone Cashlink app's
 * directory, so an edge function that resolves them the way it resolves `/cashlink/` serves the
 * wrong page with a 200 and nothing downstream notices.
 */
const SPA_ROUTES = [
    '/checkout',
    '/signup',
    '/login',
    '/sign-transaction',
    '/choose-address',
    '/cashlink/create',
    '/cashlink/manage',
];

/** The title dist/index.html carries, and therefore what an SPA route has to answer with. */
const SPA_TITLE = 'Nimiq';

/** The page whose SRI hashes are re-derived from the CDN. */
const SRI_PAGE = '/';

let hasErrors = false;

/**
 * @param {string} message
 */
function fail(message) {
    hasErrors = true;
    console.error('\x1b[31m%s\x1b[0m', `  FAIL ${message}`);
}

/**
 * @param {string} message
 */
function pass(message) {
    console.log(`  ok   ${message}`);
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => { setTimeout(resolve, ms); });
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Fetch without following redirects, so a 301 to some other host is a failure rather than an
 * invisible pass. Retries transient errors only: a 404 is a deployment bug and must not be masked
 * by a retry, which is also how `curl --retry` behaves without `-f`.
 *
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url) {
    let lastError = new Error(`could not fetch ${url}`);

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const response = await fetch(url, {
                redirect: 'manual',
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            const transient = response.status >= 500 || response.status === 429;
            if (!transient || attempt === RETRY_ATTEMPTS) return response;
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            if (attempt === RETRY_ATTEMPTS) throw error;
            lastError = /** @type {Error} */ (error);
        }
        // eslint-disable-next-line no-await-in-loop
        await sleep(RETRY_DELAY_MS);
    }

    throw lastError;
}

/**
 * @param {string} label
 * @param {string|null} actual
 * @param {string} expected
 */
function expect(label, actual, expected) {
    if (actual && actual.includes(expected)) {
        pass(`${label}: ${actual}`);
    } else {
        fail(`${label}: got '${actual || '<missing>'}', want *${expected}*`);
    }
}

/**
 * @param {string} html
 * @returns {string|null}
 */
function titleOf(html) {
    const match = html.match(/<title>([^<]*)<\/title>/i);
    return match ? match[1].trim() : null;
}

/**
 * Pull the frame-ancestors directive out of a CSP, normalising the whitespace between sources so
 * the comparison does not depend on how the policy happens to be formatted.
 *
 * @param {string|null} csp
 * @returns {string|null}
 */
function frameAncestorsOf(csp) {
    if (!csp) return null;
    const directive = csp.split(';')
        .map(part => part.trim().replace(/\s+/g, ' '))
        .find(part => part === 'frame-ancestors' || part.startsWith('frame-ancestors '));
    return directive || null;
}

/**
 * @param {string[]} sources
 * @returns {string}
 */
function sortedSources(sources) {
    return [...sources].sort().join(' ');
}

/**
 * Compare the frame-ancestors sources without depending on the order they are written in. The
 * config here and the CloudFront response-headers policy are maintained separately, and a policy
 * that lists the same origins in another order is the same policy.
 *
 * @param {string|null} csp
 * @param {string[]} expected
 */
function expectFrameAncestors(csp, expected) {
    const directive = frameAncestorsOf(csp);
    const actual = directive ? directive.split(' ').slice(1) : [];

    if (directive && actual.length === expected.length && sortedSources(actual) === sortedSources(expected)) {
        pass(`frame-ancestors: ${directive}`);
    } else {
        fail(`frame-ancestors: got '${directive || '<missing>'}', want these sources in any order: `
            + `${expected.join(' ')}`);
    }
}

/**
 * The headers every path is served with, whatever it holds.
 *
 * @param {Response} response
 * @param {Probe} probe
 */
function checkHeaders(response, probe) {
    expect('content-type', response.headers.get('content-type'), probe.contentType);
    expect('cache-control', response.headers.get('cache-control'), 'no-cache');
    expect('strict-transport-security', response.headers.get('strict-transport-security'), HSTS);
    expect('x-content-type-options', response.headers.get('x-content-type-options'), 'nosniff');
    expect('referrer-policy', response.headers.get('referrer-policy'), 'strict-origin');
    expectFrameAncestors(response.headers.get('content-security-policy'), probe.frameAncestors);

    // frame-ancestors is the control that actually stops clickjacking; X-Frame-Options ALLOW-FROM
    // has been inert in every modern browser for years, so it is only checked for presence, and for
    // DENY on the paths nothing may embed.
    const xFrameOptions = response.headers.get('x-frame-options');
    if (!xFrameOptions) {
        fail('x-frame-options: missing');
    } else if (probe.frameAncestors === NONE && xFrameOptions !== 'DENY') {
        fail(`x-frame-options: got '${xFrameOptions}', want DENY on a non-embeddable path`);
    } else {
        pass(`x-frame-options: ${xFrameOptions}`);
    }
}

/**
 * @param {Probe} probe
 * @returns {Promise<string|null>} the body, for an HTML probe that answered 200
 */
async function probePath(probe) {
    console.log(`--- ${probe.path}`);

    let response;
    try {
        response = await fetchWithRetry(`${BASE}${probe.path}`);
    } catch (error) {
        fail(`request failed: ${messageOf(error)}`);
        return null;
    }

    if (response.status !== 200) {
        fail(`HTTP ${response.status}`);
        return null;
    }

    checkHeaders(response, probe);

    if (!probe.title) return null;

    const html = await response.text();
    const title = titleOf(html);
    if (title === probe.title) {
        pass(`title: ${title}`);
    } else {
        fail(`title: got '${title || '<missing>'}', want '${probe.title}'`);
    }

    return html;
}

/**
 * Every route src/router.ts serves is a path the origin has no file for. Asserted separately from
 * PROBES because the failure is specific: a 403 or 404 here means the SPA fallback is missing, and
 * the Hub answers no requests at all even though `/` looks healthy.
 */
async function checkSpaFallback() {
    for (const path of SPA_ROUTES) {
        console.log(`--- ${path} (SPA route)`);

        /** @type {Response} */
        let response;
        try {
            // eslint-disable-next-line no-await-in-loop
            response = await fetchWithRetry(`${BASE}${path}`);
        } catch (error) {
            fail(`request failed: ${messageOf(error)}`);
            continue;
        }

        if (response.status !== 200) {
            fail(`HTTP ${response.status} -- the edge does not fall back to /index.html for `
                + 'Hub routes, so every request to the Hub fails');
            continue;
        }

        checkHeaders(response, { path, contentType: HTML, frameAncestors: NONE });

        // eslint-disable-next-line no-await-in-loop
        const title = titleOf(await response.text());
        if (title === SPA_TITLE) {
            pass(`serves the app shell`);
        } else {
            fail(`serves '${title || '<no title>'}', want the app shell ('${SPA_TITLE}')`);
        }
    }
}

/**
 * vue.config.js substitutes the deployment's own origin into index.html at build time, from
 * VUE_APP_HUB_URL for a testnet build. Serving a bundle built for another host is not something the
 * headers or the file listing can show, so compare what the page claims to be against where it
 * actually answers.
 *
 * @param {string|null} indexHtml
 */
function checkDeployedOrigin(indexHtml) {
    console.log('--- build origin');

    if (!indexHtml) {
        fail('could not read / to check the origin it was built for');
        return;
    }

    const meta = indexHtml.match(/<meta\s+name="url"\s+content="([^"]*)"/i);
    if (!meta) {
        fail('no <meta name="url"> in /, which vue.config.js always substitutes');
        return;
    }

    const declared = meta[1].replace(/\/+$/, '');
    if (declared === BASE) {
        pass(`built for ${declared}`);
    } else {
        fail(`built for ${declared || '<empty>'}, but deployed at ${BASE}`
            + ' -- check the build\'s VUE_APP_HUB_URL');
    }
}

/**
 * @typedef {object} SriResource
 * @property {string|null} url - null when a tag carries an integrity hash but no src or href
 * @property {string} integrity
 */

/**
 * Collect every subresource the page pins with an SRI hash. Attribute order is not assumed:
 * HtmlWebpackPlugin emits src before integrity today, and this must keep working if that changes.
 *
 * @param {string} html
 * @returns {SriResource[]}
 */
function extractSriResources(html) {
    const tags = html.match(/<(?:script|link)\b[^>]*>/gi) || [];

    /** @type {SriResource[]} */
    const resources = [];

    for (const tag of tags) {
        const integrity = tag.match(/\sintegrity\s*=\s*"([^"]+)"/i);
        if (!integrity) continue;
        const url = tag.match(/\s(?:src|href)\s*=\s*"([^"]+)"/i);
        resources.push({ url: url ? url[1] : null, integrity: integrity[1] });
    }

    return resources;
}

/**
 * Re-derive each SRI hash from the bytes the CDN serves. fetch() decodes gzip and brotli the way a
 * browser does, which is what makes this meaningful: SRI is computed over the decoded body, so a
 * CDN that re-compresses must still produce the hash the HTML pins.
 *
 * The algorithm comes from the attribute rather than being fixed: vue-cli's `integrity` option
 * emits sha384 for the bundles it injects, while the browser-warning tag vue.config.js writes by
 * hand carries a sha256.
 *
 * @param {SriResource[]} resources
 * @returns {Promise<number>}
 */
async function verifySriResources(resources) {
    let verified = 0;

    for (const resource of resources) {
        if (!resource.url) {
            fail(`integrity="${resource.integrity}" on a tag with no src or href`);
            continue;
        }

        // Strongest first, which is also the one a browser picks when a tag lists several.
        const expected = ['sha512', 'sha384', 'sha256']
            .map(algorithm => resource.integrity.trim().split(/\s+/)
                .find(hash => hash.startsWith(`${algorithm}-`)))
            .find(Boolean);
        if (!expected) {
            fail(`${resource.url}: no sha256/sha384/sha512 hash in integrity="${resource.integrity}"`);
            continue;
        }

        const algorithm = expected.slice(0, expected.indexOf('-'));
        const url = new URL(resource.url, `${BASE}/`).href;
        let response;
        try {
            // eslint-disable-next-line no-await-in-loop
            response = await fetchWithRetry(url);
        } catch (error) {
            fail(`${resource.url}: request failed: ${messageOf(error)}`);
            continue;
        }

        if (response.status !== 200) {
            fail(`${resource.url}: HTTP ${response.status}`);
            continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const body = Buffer.from(await response.arrayBuffer());
        const actual = `${algorithm}-${createHash(algorithm).update(body).digest('base64')}`;
        if (actual !== expected) {
            fail(`SRI ${resource.url} (html=${expected} served=${actual})`);
        } else {
            verified += 1;
        }
    }

    return verified;
}

/**
 * @param {string|null} html
 * @returns {Promise<void>}
 */
async function checkSri(html) {
    console.log(`--- SRI (${SRI_PAGE})`);

    if (!html) {
        fail(`could not fetch ${SRI_PAGE} for SRI verification`);
        return;
    }

    const resources = extractSriResources(html);
    const verified = await verifySriResources(resources);

    if (verified < MIN_SRI_RESOURCES) {
        fail(`verified only ${verified} SRI-protected resources, expected at least ${MIN_SRI_RESOURCES}`);
    } else {
        pass(`verified ${verified} SRI-protected resources`);
    }
}

/**
 * @returns {Promise<void>}
 */
async function main() {
    if (!BASE) {
        console.error('\x1b[31m%s\x1b[0m',
            'ERROR: usage: node tools/deploymentValidator.js <base-url> [testnet|mainnet]');
        process.exit(1);
    }

    console.log(`Validating ${BUILD} deployment at ${BASE}`);

    const privileged = privilegedOrigins(BUILD);
    console.log(`privilegedOrigins: ${privileged.join(' ')}`);

    /** @type {string|null} */
    let indexHtml = null;

    for (const probe of probesFor(BUILD, privileged)) {
        // Sequential on purpose: a failing deployment should not be hit with a burst of parallel
        // requests, and the output stays readable.
        // eslint-disable-next-line no-await-in-loop
        const html = await probePath(probe);
        if (probe.path === '/') indexHtml = html;
    }

    await checkSpaFallback();
    checkDeployedOrigin(indexHtml);
    await checkSri(indexHtml);

    if (hasErrors) {
        console.error('\x1b[31m%s\x1b[0m', `\nERROR: deployment at ${BASE} failed validation`);
        process.exit(1);
    }

    console.log('\x1b[32m%s\x1b[0m', `\nOK: deployment at ${BASE} is valid`);
}

main().catch(error => {
    console.error('\x1b[31m%s\x1b[0m', `ERROR: ${messageOf(error)}`);
    process.exit(1);
});
