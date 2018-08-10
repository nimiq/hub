class RequestBehavior {
    constructor(type) {
        this._type = type;
    }
    async request(endpoint, command, args) {
        throw new Error('Not implemented');
    }
    get type() {
        return this._type;
    }
    static getAllowedOrigin(endpoint) {
        // FIXME derive from endpoint url
        return '*';
    }
}
var BehaviorType;
(function (BehaviorType) {
    BehaviorType[BehaviorType["REDIRECT"] = 0] = "REDIRECT";
    BehaviorType[BehaviorType["POPUP"] = 1] = "POPUP";
})(BehaviorType || (BehaviorType = {}));
class RedirectRequestBehavior extends RequestBehavior {
    static withLocalState(localState) {
        return new RedirectRequestBehavior(undefined, localState);
    }
    constructor(targetUrl, localState) {
        super(BehaviorType.REDIRECT);
        const location = window.location;
        this._targetUrl = targetUrl || `${location.protocol}//${location.hostname}:${location.port}${location.pathname}`;
        this._localState = localState || {};
        // Reject local state with reserved property.
        if (typeof this._localState.__command !== 'undefined') {
            throw new Error('Invalid localState: Property \'__command\' is reserved');
        }
    }
    async request(endpoint, command, args) {
        const origin = RequestBehavior.getAllowedOrigin(endpoint);
        const client = new Rpc.RedirectRpcClient(endpoint, origin);
        await client.init();
        const state = Object.assign({ __command: command }, this._localState);
        console.log('state', state);
        client.callAndSaveLocalState(this._targetUrl, state, command, ...args);
    }
}
class PopupRequestBehavior extends RequestBehavior {
    constructor(options = PopupRequestBehavior.DEFAULT_OPTIONS) {
        super(BehaviorType.POPUP);
        this._options = options;
    }
    async request(endpoint, command, args) {
        const origin = RequestBehavior.getAllowedOrigin(endpoint);
        const popup = this.createPopup(endpoint);
        const client = new Rpc.PostMessageRpcClient(popup, origin);
        await client.init();
        try {
            const result = await client.call(command, ...args);
            client.close();
            popup.close();
            return result;
        }
        catch (e) {
            client.close();
            popup.close();
            throw e;
        }
    }
    createPopup(url) {
        const popup = window.open(url, 'NimiqAccounts', this._options);
        if (!popup) {
            throw new Error('Failed to open popup');
        }
        return popup;
    }
}
PopupRequestBehavior.DEFAULT_OPTIONS = '';
