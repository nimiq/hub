/*
 * The slice of the GitHub REST API the deploy gates need.
 *
 * Dependency-free on purpose: these scripts run on the runner's preinstalled Node, before
 * `yarn install`, so that nothing from the ref has been executed while the ref is still being
 * judged.
 */

const API_URL = process.env.GITHUB_API_URL || 'https://api.github.com';

const TIMEOUT_MS = 30000;

/**
 * @param {string} endpoint
 * @returns {Promise<any>}
 */
async function api(endpoint) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN is not set');

    const response = await fetch(`${API_URL}/${endpoint}`, {
        headers: {
            accept: 'application/vnd.github+json',
            authorization: `Bearer ${token}`,
            'user-agent': 'nimiq-hub-deploy',
            'x-github-api-version': '2022-11-28',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
        throw new Error(`GET ${endpoint} returned HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
}

module.exports = { api };
