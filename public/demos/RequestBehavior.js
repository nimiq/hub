/* global Rpc */

class RequestBehavior {
    /**
     * @param {RequestBehavior.Type} type
     */
    constructor(type) {
        this._type = type;
    }

    /**
     * @param {string} endpoint
     * @param {AccountsClient.Command} command
     * @param {Array<*>} args
     * @returns {Promise<*>}
     */
    async request(endpoint, command, args) { // eslint-disable-line no-unused-vars
        throw new Error('Not implemented');
    }

    /**
     * @type {RequestBehavior.Type}
     */
    get type() {
        return this._type;
    }

    /**
     * @param {string} endpoint
     * @returns {string}
     */
    static getAllowedOrigin(endpoint) {
        // FIXME derive from endpoint url
        return '*';
    }

    /**
     * @param {string} endpoint
     * @param {AccountsClient.Command} command
     * @returns {string}
     */
    static getRequestUrl(endpoint, command) {
        return `${endpoint}/request/${command}/`;
    }

}
/** @enum {number} */
RequestBehavior.Type = {
    REDIRECT: 1,
    POPUP: 2,
};

// eslint-disable-next-line no-unused-vars
class RedirectRequestBehavior extends RequestBehavior {
    /**
     * @param {*} localState
     * @returns {RedirectRequestBehavior}
     */
    static withLocalState(localState) {
        return new RedirectRequestBehavior(undefined, localState);
    }

    /**
     * @param {string} [targetUrl]
     * @param {*} [localState]
     */
    constructor(targetUrl, localState) {
        super(RequestBehavior.Type.REDIRECT);
        const location = window.location;
        this._targetUrl = targetUrl || `${location.protocol}//${location.hostname}${location.pathname}`;
        this._localState = localState || {};

        // Reject local state with reserved property.
        if (typeof localState.__command !== 'undefined') {
            throw new Error('Invalid localState: Property \'__command\' is reserved');
        }
    }

    /**
     * @param {string} endpoint
     * @param {AccountsClient.Command} command
     * @param {Array<*>} args
     * @returns {Promise<*>}
     */
    async request(endpoint, command, args) {
        const url = RequestBehavior.getRequestUrl(endpoint, command);
        const origin = RequestBehavior.getAllowedOrigin(endpoint);

        const client = new Rpc.RedirectRpcClient(url, origin);
        await client.init();

        const state = Object.assign({ __command: command }, this._localState);
        console.log('state', state);
        client.callAndSaveLocalState(this._targetUrl, state, 'request', ...args);
    }
}

// eslint-disable-next-line no-unused-vars
class PopupRequestBehavior extends RequestBehavior {
    /**
     * @param {string} [options]
     */
    constructor(options = PopupRequestBehavior.DEFAULT_OPTIONS) {
        super(RequestBehavior.Type.POPUP);
        this._options = options;
    }

    /**
     * @param {string} endpoint
     * @param {AccountsClient.Command} command
     * @param {Array<*>} args
     * @returns {Promise<*>}
     */
    async request(endpoint, command, args) {
        const url = RequestBehavior.getRequestUrl(endpoint, command);
        const origin = RequestBehavior.getAllowedOrigin(endpoint);

        const popup = this.createPopup(url);
        const client = new Rpc.PostMessageRpcClient(popup, origin);
        await client.init();

        try {
            const result = await client.call('request', ...args);
            client.close();
            popup.close();
            return result;
        } catch (e) {
            client.close();
            popup.close();
            throw e;
        }
    }

    /**
     * @param {string} url
     * @returns {Window}
     */
    createPopup(url) {
        const popup = window.open(url, 'NimiqKeyguard', this._options);
        if (!popup) {
            throw new Error('Failed to open popup');
        }
        return popup;
    }
}
// eslint-disable-next-line max-len
PopupRequestBehavior.DEFAULT_OPTIONS = '';
