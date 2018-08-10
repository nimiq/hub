/* global Nimiq */
/* global Rpc */
/* global RequestBehavior */
/* global PopupRequestBehavior */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var AccountsManagerClient = /** @class */ (function () {
    /**
     * @param {string} endpoint
     * @param {RequestBehavior} [defaultBehavior]
     */
    function AccountsManagerClient(endpoint, defaultBehavior) {
        if (endpoint === void 0) { endpoint = '../src'; }
        this._endpoint = endpoint;
        this._defaultBehavior = defaultBehavior || new PopupRequestBehavior();
        this._redirectClient = new Rpc.RedirectRpcClient('', RequestBehavior.getAllowedOrigin(this._endpoint));
        this._redirectClient.onResponse('request', this._onResolve.bind(this), this._onReject.bind(this));
        this._observable = new Nimiq.Observable();
    }
    AccountsManagerClient.prototype.init = function () {
        return this._redirectClient.init();
    };
    /**
     * @param {AccountsManagerClient.Command} command
     * @param {Function} resolve
     * @param {Function} reject
     */
    AccountsManagerClient.prototype.on = function (command, resolve, reject) {
        this._observable.on(command + "-resolve", resolve);
        this._observable.on(command + "-reject", reject);
    };
    /**
     * @param {string} defaultKeyPath
     * @param {RequestBehavior} [requestBehavior]
     * @returns {Promise<*>}
     */
    AccountsManagerClient.prototype.create = function (defaultKeyPath, requestBehavior) {
        if (requestBehavior === void 0) { requestBehavior = this._defaultBehavior; }
        return this._request(requestBehavior, AccountsManagerClient.Command.CREATE, [{ defaultKeyPath: defaultKeyPath }]);
    };
    /**
     * @param {string} keyId
     * @param {RequestBehavior} [requestBehavior]
     * @returns {Promise<*>}
     */
    AccountsManagerClient.prototype.remove = function (keyId, requestBehavior) {
        if (requestBehavior === void 0) { requestBehavior = this._defaultBehavior; }
        return this._request(requestBehavior, AccountsManagerClient.Command.REMOVE, [{ keyId: keyId }]);
    };
    /**
     * @param {string} defaultKeyPath
     * @param {RequestBehavior} [requestBehavior]
     * @returns {Promise<*>}
     */
    AccountsManagerClient.prototype.importWords = function (defaultKeyPath, requestBehavior) {
        if (requestBehavior === void 0) { requestBehavior = this._defaultBehavior; }
        return this._request(requestBehavior, AccountsManagerClient.Command.IMPORT_WORDS, [{ defaultKeyPath: defaultKeyPath }]);
    };
    /**
     * @param {RequestBehavior} [requestBehavior]
     * @returns {Promise<*>}
     */
    AccountsManagerClient.prototype.importFile = function (requestBehavior) {
        if (requestBehavior === void 0) { requestBehavior = this._defaultBehavior; }
        return this._request(requestBehavior, AccountsManagerClient.Command.IMPORT_FILE, []);
    };
    /**
     * @param {string} keyId
     * @param {RequestBehavior} [requestBehavior]
     * @returns {Promise<void>}
     */
    AccountsManagerClient.prototype.exportWords = function (keyId, requestBehavior) {
        if (requestBehavior === void 0) { requestBehavior = this._defaultBehavior; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._request(requestBehavior, AccountsManagerClient.Command.EXPORT_WORDS, [{ keyId: keyId }])];
            });
        });
    };
    /**
     * @param {string} keyId
     * @param {RequestBehavior} [requestBehavior]
     * @returns {Promise<void>}
     */
    AccountsManagerClient.prototype.exportFile = function (keyId, requestBehavior) {
        if (requestBehavior === void 0) { requestBehavior = this._defaultBehavior; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._request(requestBehavior, AccountsManagerClient.Command.EXPORT_FILE, [{ keyId: keyId }])];
            });
        });
    };
    /**
     * @param {SignTransactionRequest} request
     * @param {RequestBehavior} [requestBehavior]
     * @returns {Promise<SignTransactionResult>}
     */
    AccountsManagerClient.prototype.signTransaction = function (request, requestBehavior) {
        if (requestBehavior === void 0) { requestBehavior = this._defaultBehavior; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._request(requestBehavior, AccountsManagerClient.Command.SIGN_TRANSACTION, [request])];
            });
        });
    };
    /**
     * @param {SignMessageRequest} request
     * @param {RequestBehavior} [requestBehavior]
     * @returns {Promise<SignMessageResult>}
     */
    AccountsManagerClient.prototype.signMessage = function (request, requestBehavior) {
        if (requestBehavior === void 0) { requestBehavior = this._defaultBehavior; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._request(requestBehavior, AccountsManagerClient.Command.SIGN_MESSAGE, [request])];
            });
        });
    };
    // /**
    //  * @param {boolean} [listFromAccountStore] Deprecated, list from old AccountStore
    //  * @returns {Promise<KeyInfo[] | AccountInfo[]>}
    //  */
    // async list(listFromAccountStore) {
    //     await this._connected;
    //     return this.iframeClient.call('list', [listFromAccountStore]);
    // }
    //
    // /**
    //  * @returns {Promise<boolean>}
    //  * @deprecated Only for database migration
    //  */
    // async migrateDB() {
    //     await this._connected;
    //     return this.iframeClient.call('migrateAccountsToKeys');
    // }
    AccountsManagerClient.prototype.createPopup = function (command, options) {
        var url = RequestBehavior.getRequestUrl(this._endpoint, command);
        var behavior = new PopupRequestBehavior(options);
        return behavior.createPopup(url);
    };
    /* PRIVATE METHODS */
    /**
     * @param {RequestBehavior} behavior
     * @param {AccountsManagerClient.Command} command
     * @param {Array<*>} args
     * @returns {Promise.<*>}
     * @private
     */
    AccountsManagerClient.prototype._request = function (behavior, command, args) {
        return behavior.request(this._endpoint, command, args);
    };
    AccountsManagerClient.prototype._onResolve = function (result, id, state) {
        var command = state.__command;
        if (!command) {
            throw new Error('Invalid state after RPC request');
        }
        delete state.__command;
        this._observable.fire(command + "-resolve", result, state);
    };
    AccountsManagerClient.prototype._onReject = function (error, id, state) {
        var command = state.__command;
        if (!command) {
            throw new Error('Invalid state after RPC request');
        }
        delete state.__command;
        this._observable.fire(command + "-reject", error, state);
    };
    return AccountsManagerClient;
}());
// FIXME Replace by real origin (or from config)
AccountsManagerClient.KEYGUARD_ORIGIN = '*';
/** @enum {string} */
AccountsManagerClient.Command = {
    CREATE: 'create',
    REMOVE: 'remove-key',
    IMPORT_WORDS: 'import-words',
    IMPORT_FILE: 'import-file',
    EXPORT_WORDS: 'export-words',
    EXPORT_FILE: 'export-file',
    SIGN_TRANSACTION: 'sign-transaction',
    SIGN_MESSAGE: 'sign-message'
};
