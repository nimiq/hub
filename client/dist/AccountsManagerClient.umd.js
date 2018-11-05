(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('@nimiq/rpc')) :
    typeof define === 'function' && define.amd ? define(['@nimiq/rpc'], factory) :
    (global.AccountsManagerClient = factory(global.rpc));
}(this, (function (rpc) { 'use strict';

    class RequestBehavior {
        static getAllowedOrigin(endpoint) {
            const url = new URL(endpoint);
            return url.origin;
        }
        constructor(type) {
            this._type = type;
        }
        async request(endpoint, command, args) {
            throw new Error('Not implemented');
        }
        get type() {
            return this._type;
        }
    }
    var BehaviorType;
    (function (BehaviorType) {
        BehaviorType[BehaviorType["REDIRECT"] = 0] = "REDIRECT";
        BehaviorType[BehaviorType["POPUP"] = 1] = "POPUP";
        BehaviorType[BehaviorType["IFRAME"] = 2] = "IFRAME";
    })(BehaviorType || (BehaviorType = {}));
    class RedirectRequestBehavior extends RequestBehavior {
        static withLocalState(localState) {
            return new RedirectRequestBehavior(undefined, localState);
        }
        constructor(returnUrl, localState) {
            super(BehaviorType.REDIRECT);
            const location = window.location;
            this._returnUrl = returnUrl || `${location.origin}${location.pathname}`;
            this._localState = localState || {};
            // Reject local state with reserved property.
            if (typeof this._localState.__command !== 'undefined') {
                throw new Error('Invalid localState: Property \'__command\' is reserved');
            }
        }
        async request(endpoint, command, args) {
            const origin = RequestBehavior.getAllowedOrigin(endpoint);
            const client = new rpc.RedirectRpcClient(endpoint, origin);
            await client.init();
            const state = Object.assign({ __command: command }, this._localState);
            console.log('state', state);
            client.callAndSaveLocalState(this._returnUrl, JSON.stringify(state), command, ...args);
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
            const client = new rpc.PostMessageRpcClient(popup, origin);
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
    class IFrameRequestBehavior extends RequestBehavior {
        constructor() {
            super(BehaviorType.IFRAME);
            this._iframe = null;
            this._client = null;
        }
        async request(endpoint, command, args) {
            if (this._iframe && this._iframe.src !== `${endpoint}${IFrameRequestBehavior.IFRAME_PATH_SUFFIX}`) {
                throw new Error('Accounts Manager iframe is already opened with another endpoint');
            }
            const origin = RequestBehavior.getAllowedOrigin(endpoint);
            if (!this._iframe) {
                this._iframe = await this.createIFrame(endpoint);
            }
            if (!this._iframe.contentWindow) {
                throw new Error(`IFrame contentWindow is ${typeof this._iframe.contentWindow}`);
            }
            if (!this._client) {
                this._client = new rpc.PostMessageRpcClient(this._iframe.contentWindow, origin);
                await this._client.init();
            }
            return await this._client.call(command, ...args);
        }
        async createIFrame(endpoint) {
            return new Promise((resolve, reject) => {
                const $iframe = document.createElement('iframe');
                $iframe.name = 'NimiqAccountsIFrame';
                $iframe.style.display = 'none';
                document.body.appendChild($iframe);
                $iframe.src = `${endpoint}${IFrameRequestBehavior.IFRAME_PATH_SUFFIX}`;
                $iframe.onload = () => resolve($iframe);
                $iframe.onerror = reject;
            });
        }
    }
    IFrameRequestBehavior.IFRAME_PATH_SUFFIX = '/iframe.html';

    var RequestType;
    (function (RequestType) {
        RequestType["LIST"] = "list";
        RequestType["CHECKOUT"] = "checkout";
        RequestType["SIGNTRANSACTION"] = "sign-transaction";
        RequestType["SIGNUP"] = "signup";
        RequestType["LOGIN"] = "login";
        RequestType["EXPORT_WORDS"] = "export-words";
        RequestType["EXPORT_FILE"] = "export-file";
        RequestType["LOGOUT"] = "logout";
    })(RequestType || (RequestType = {}));

    class AccountsManagerClient {
        constructor(endpoint = AccountsManagerClient.DEFAULT_ENDPOINT, defaultBehavior) {
            this._endpoint = endpoint;
            this._defaultBehavior = defaultBehavior || new PopupRequestBehavior(`left=${window.innerWidth / 2 - 500},top=50,width=1000,height=900,location=yes,dependent=yes`);
            this._iframeBehavior = new IFrameRequestBehavior();
            // Check for RPC results in the URL
            this._redirectClient = new rpc.RedirectRpcClient('', RequestBehavior.getAllowedOrigin(this._endpoint));
        }
        init() {
            return this._redirectClient.init();
        }
        on(command, resolve, reject) {
            this._redirectClient.onResponse(command, resolve, reject);
        }
        signup(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.SIGNUP, [request]);
        }
        signTransaction(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.SIGNTRANSACTION, [request]);
        }
        checkout(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.CHECKOUT, [request]);
        }
        login(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.LOGIN, [request]);
        }
        logout(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.LOGOUT, [request]);
        }
        exportFile(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.EXPORT_FILE, [request]);
        }
        exportWords(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.EXPORT_WORDS, [request]);
        }
        /**
         * Only accessible in iframe from Nimiq domains.
         */
        list(requestBehavior = this._iframeBehavior) {
            return this._request(requestBehavior, RequestType.LIST, []);
        }
        // END API
        /* PRIVATE METHODS */
        _request(behavior, command, args) {
            return behavior.request(this._endpoint, command, args);
        }
    }
    AccountsManagerClient.DEFAULT_ENDPOINT = window.location.origin === 'https://safe-next.nimiq.com' ? 'https://accounts.nimiq.com'
        : window.location.origin === 'https://safe-next.nimiq-testnet.com' ? 'https://accounts.nimiq-testnet.com'
            : 'http://localhost:8080';
    AccountsManagerClient.RequestType = RequestType;
    AccountsManagerClient.RedirectRequestBehavior = RedirectRequestBehavior;

    return AccountsManagerClient;

})));
