import Config from 'config';
import { ENV_DEV } from './Constants';

const DELIMITER = '#';

export async function replaceKey(input: string): Promise<string> {
    const sections = input.split(DELIMITER);

    // If the delimiter is not in the input exactly twice, do nothing
    if (sections.length !== 3) return input;

    const keyName = sections[1];
    let key: string;
    if (Config.environment === ENV_DEV) {
        // Use specification in an env file as alternative mechanism to fetching the key from the server. This has the
        // advantage especially for development keys that they don't have to sit in the /public folder as fetchable
        // file, which would end up in the builds and deployments even for testnet and mainnet build targets. This is
        // important as development keys can be especially powerful, compared to other keys, as they typically allow
        // access from localhost or any domain.
        // The env file must be listed in .gitignore to avoid it being exposed in the repository and must be included
        // only in dev builds, to avoid the key still becoming exposed as part of the app build for other build targets.
        // Thus, it's recommendable to keep the keys in a .env.development.local file, which is already configured that
        // way by the Vue CLI, see https://cli.vuejs.org/guide/mode-and-env.html#environment-variables.
        // Note for dev builds, the key is then included in the app build, and could be exposed that way, but typically,
        // dev builds are not publicly deployed, such that this shouldn't be a problem.
        const processEnvKeyName = `VUE_APP_${keyName}`;
        const processEnvKey = process.env[processEnvKeyName];
        if (!processEnvKey) {
            throw new Error(`process.env['${processEnvKeyName}'] not found for dev build. `
                + 'Missing file .env.development.local?');
        }
        key = processEnvKey;
    } else {
        const fileName = `${Config.environment}_k_${btoa(keyName)}`;
        key = atob(
            await fetch(`/${fileName}`)
                .then((res) => res.text())
                .then((text) => text.replace(/\s/g, '')), // Remove any whitespace & newlines
        );
    }

    // Replace the key name with the key itself
    sections[1] = key;

    // Create the resulting string without the delimiters
    return sections.join('');
}
