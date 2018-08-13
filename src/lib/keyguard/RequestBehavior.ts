import {RedirectRpcClient} from '@nimiq/rpc';
import {KeyguardCommand} from '@/lib/keyguard/RequestTypes';

export class RequestBehavior {

    public static getAllowedOrigin(endpoint: string) {
        // FIXME derive from endpoint url
        return '*';
    }

    public static getRequestUrl(endpoint: string, command: KeyguardCommand) {
        return `${endpoint}/request/${command}/`;
    }
    private _targetUrl: string;
    private _localState: any;

    constructor(targetUrl?: string, localState?: any) {
        const location = window.location;
        this._targetUrl = targetUrl
            || `${location.protocol}//${location.hostname}:${location.port}${location.pathname}`;
        this._localState = localState || {};

        // Reject local state with reserved property.
        if (localState && typeof localState.__command !== 'undefined') {
            throw new Error('Invalid localState: Property \'__command\' is reserved');
        }
    }

    public async request(endpoint: string, command: KeyguardCommand, args: any[]) {
        const url = RequestBehavior.getRequestUrl(endpoint, command);
        const origin = RequestBehavior.getAllowedOrigin(endpoint);

        const client = new RedirectRpcClient(url, origin);
        await client.init();

        const state = Object.assign({__command: command}, this._localState);
        client.callAndSaveLocalState(this._targetUrl, state, 'request', ...args);
    }

}
