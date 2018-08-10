class AccountsManagerClient {
    constructor(endpoint = AccountsManagerClient.DEFAULT_ENDPOINT, defaultBehavior) {
        this._endpoint = endpoint;
        this._defaultBehavior = defaultBehavior || new PopupRequestBehavior();
        this._redirectClient = new Rpc.RedirectRpcClient('', RequestBehavior.getAllowedOrigin(this._endpoint));
        this._redirectClient.onResponse('request', this._onResolve.bind(this), this._onReject.bind(this));
        this._observable = new Nimiq.Observable();
    }
    init() {
        return this._redirectClient.init();
    }
    /**
     * @param {AccountsManagerClient.Command} command
     * @param {Function} resolve
     * @param {Function} reject
     */
    on(command, resolve, reject) {
        this._observable.on(`${command}-resolve`, resolve);
        this._observable.on(`${command}-reject`, reject);
    }
    checkout(request, requestBehavior = this._defaultBehavior) {
        return this._request(requestBehavior, RequestType.CHECKOUT, [request]);
    }
    createPopup(options) {
        const behavior = new PopupRequestBehavior(options);
        return behavior.createPopup(this._endpoint);
    }
    /* PRIVATE METHODS */
    _request(behavior, command, args) {
        return behavior.request(this._endpoint, command, args);
    }
    _onReject(error, id, state) {
        const command = state.__command;
        if (!command) {
            throw new Error('Invalid state after RPC request');
        }
        delete state.__command;
        this._observable.fire(`${command}-reject`, error, state);
    }
    _onResolve(result, id, state) {
        const command = state.__command;
        if (!command) {
            throw new Error('Invalid state after RPC request');
        }
        delete state.__command;
        this._observable.fire(`${command}-resolve`, result, state);
    }
}
AccountsManagerClient.DEFAULT_ENDPOINT = '../src';
