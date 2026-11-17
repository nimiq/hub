#!/usr/bin/env node

/*
 * Verifies that the ref being deployed is an annotated tag carrying a valid signature.
 *
 * The deploy only ever runs on a published release, and a release always carries a tag, so the tag
 * under test is the release's (TAG_NAME).
 *
 * Chain of custody: deploy.sh cuts annotated, GPG-signed tags (`git tag -a -s`) in this repository
 * and in deployment-hub, and the SSH deployment path carries that signature all the way to the
 * server. This asserts the equivalent so the S3 path is not a weaker way to ship the same bytes.
 *
 * GitHub validates the signature against the keys registered on the tagger's account, so there is
 * no keyring to manage on the runner. That also means this step needs nothing from the repository
 * beyond the tag name, and runs on the runner's preinstalled Node before any dependency is
 * installed or any build script is executed.
 *
 * Environment:
 *   GITHUB_TOKEN      required, needs `contents: read`
 *   TAG_NAME          required, the release's tag
 *   ALLOWED_TAGGERS   optional comma-separated tagger allowlist; unset means "any valid signature"
 */

const { api } = require('./github-api');

const REPOSITORY = process.env.GITHUB_REPOSITORY;
const TAG_NAME = process.env.TAG_NAME || '';
const ALLOWED_TAGGERS = (process.env.ALLOWED_TAGGERS || '').split(',').map(entry => entry.trim()).filter(Boolean);

/**
 * Encode a ref for use in a URL path without escaping its separators, so that tags containing a
 * slash still address the right endpoint.
 *
 * @param {string} ref
 * @returns {string}
 */
function encodeRef(ref) {
    return ref.split('/').map(encodeURIComponent).join('/');
}

/**
 * Resolve the tag to an annotated tag object and check the signature GitHub verified for it. Every
 * problem here stops the deploy: there is no trigger that can ask for an unsigned tag to be shipped
 * anyway.
 *
 * @returns {Promise<string>} the signer's email
 */
async function verifiedTagger() {
    if (!TAG_NAME) throw new Error('TAG_NAME is unset, so there is no tag to verify');

    // Annotated tags point at a tag object; lightweight tags point straight at the commit and can
    // never carry a signature.
    const ref = await api(`repos/${REPOSITORY}/git/ref/tags/${encodeRef(TAG_NAME)}`);
    if (ref.object.type !== 'tag') {
        throw new Error(`'${TAG_NAME}' is a lightweight tag and cannot carry a signature.`
            + ' Cut deployable tags with `git tag -a -s`, as deploy.sh does.');
    }

    const tag = await api(`repos/${REPOSITORY}/git/tags/${ref.object.sha}`);
    const verification = tag.verification || {};
    const tagger = (tag.tagger && tag.tagger.email) || 'unknown';

    console.log(`tag ${TAG_NAME}: verified=${verification.verified} reason=${verification.reason} tagger=${tagger}`);

    if (verification.verified !== true) {
        throw new Error(`tag ${TAG_NAME} signature is not verified (${verification.reason}).`
            + " Check that the signing key is registered on the tagger's GitHub account.");
    }

    return tagger;
}

/**
 * @returns {Promise<void>}
 */
async function main() {
    const tagger = await verifiedTagger();

    // Optional: restrict who may cut a deployable tag. An unset allowlist means "any valid
    // signature", which is already gated by the environment's required reviewers.
    if (ALLOWED_TAGGERS.length && !ALLOWED_TAGGERS.includes(tagger)) {
        throw new Error(`tagger ${tagger} is not in ALLOWED_TAGGERS`);
    }

    console.log(`tag ${TAG_NAME} is signed by ${tagger} and verified by GitHub`);
}

main().catch(/** @param {Error} error */ error => {
    console.log(`::error::${error.message}`);
    process.exit(1);
});
