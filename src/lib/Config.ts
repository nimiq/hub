export default class Config {

    // Signal if the app should be started in offline mode
    public static offline = navigator.onLine !== undefined && !navigator.onLine;

    // When packaged as distributed offline app, subdomains are folder names instead
    public static offlinePackaged = false;

    /* Public methods */

    public static origin(subdomain: string) {
        return Config._origin(subdomain);
    }

    public static src(subdomain: string) {
        return Config._origin(subdomain, true);
    }

    public static get mainDomain() {
        // NOTE: This only works for single TLDs (like .com or .org),
        // but not for two-part TLDs (like .co.uk or .com.au).
        // We are only using it on nimiq.com and nimiq-network.com.
        const mainDomain = Config._myOrigin.split('.');
        return [mainDomain[mainDomain.length - 2], mainDomain[mainDomain.length - 1]].join('.');
    }

    public static get network() {
        if (Config.offlinePackaged) return 'main';

        switch (Config.mainDomain) {
            case 'nimiq.com': return 'main';
            case 'nimiq-testnet.com': return 'test';
            default: return 'test'; // Set this to 'test', 'bounty', or 'dev' for localhost development
        }
    }

    public static get cdn() {
        // FIXME: Correct the path to nimiq.js when the location is known
        if (Config.offlinePackaged) return './nimiq.js';

        switch (Config.mainDomain) {
            case 'nimiq.com': return 'https://cdn.nimiq.com/nimiq.js';
            default: return 'https://cdn.nimiq-testnet.com/nimiq.js';
        }
    }

    public static set devMode(devMode) {
        Config.isDevMode = devMode;
    }

    public static get devMode() {
        if (Config.isDevMode) return Config.isDevMode;

        switch (Config.mainDomain) {
            case 'nimiq.com':
            case 'nimiq-testnet.com':
                return false;
            default:
                return true;
        }
    }

    public static get online() {
        return !Config.offline;
    }

    /**
     * The PermissionStore is filled on creation
     * with full permissions for the below origins.
     */
    public static get nimiqOrigins() {
        return [
            Config.origin('safe'),
            Config.origin('miner'),
            Config.origin('promo'),
            // Config.origin('shop'),
        ];
    }

    /* Private methods */

    private static isDevMode: boolean = false;

    private static _origin(subdomain: string, withPath?: boolean) {
        if (Config._myOrigin.includes('localhost')) {
            return Config._localhost(subdomain, withPath);
        }

        if (Config.devMode) {
            return Config._localhost(subdomain, withPath, true);
        }

        return `https://${subdomain}.${Config.mainDomain}${withPath ? '/' : ''}`;
    }

    private static _localhost(subdomain: string, withPath?: boolean, ipMode?: boolean) {
        const path = '';

        // TODO: Re-evaluate when deployment structure is known

        // if (withPath) {
        //     if (Config.offlinePackaged) path = `/${subdomain}/`;
        //     else {

        //         switch (subdomain) {
        //             case 'keyguard': path = '/libraries/keyguard/'; break;
        //             case 'network': path = '/libraries/network/'; break;
        //         }

        //         if (location.pathname.includes('/dist')) {
        //             path += `deployment-${subdomain}/dist/`;
        //         } else if (['keyguard', 'network', 'safe'].indexOf(subdomain) > -1) {
        //             path += 'src/';
        //         // }
        //     }
        // }

        subdomain = Config.offlinePackaged ? '' : `${subdomain}.`;

        const origin = ipMode ? location.hostname : `${subdomain}localhost`;

        return `${location.protocol}//${origin}${location.port ? `:${location.port}` : ''}${path}`;
    }

    private static get _myOrigin() {
        if (location.origin === 'null') {
            // NodeJS environment
            return 'https://accounts.nimiq-testnet.com';
        }
        return location.origin;
    }
}
