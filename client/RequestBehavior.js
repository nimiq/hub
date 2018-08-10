"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.__esModule = true;
var rpc_1 = require("@nimiq/rpc");
var RequestBehavior = /** @class */ (function () {
    function RequestBehavior(type) {
        this._type = type;
    }
    RequestBehavior.prototype.request = function (endpoint, command, args) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                throw new Error('Not implemented');
            });
        });
    };
    Object.defineProperty(RequestBehavior.prototype, "type", {
        get: function () {
            return this._type;
        },
        enumerable: true,
        configurable: true
    });
    RequestBehavior.getAllowedOrigin = function (endpoint) {
        // FIXME derive from endpoint url
        return '*';
    };
    return RequestBehavior;
}());
var BehaviorType;
(function (BehaviorType) {
    BehaviorType[BehaviorType["REDIRECT"] = 0] = "REDIRECT";
    BehaviorType[BehaviorType["POPUP"] = 1] = "POPUP";
})(BehaviorType || (BehaviorType = {}));
var RedirectRequestBehavior = /** @class */ (function (_super) {
    __extends(RedirectRequestBehavior, _super);
    function RedirectRequestBehavior(targetUrl, localState) {
        var _this = _super.call(this, BehaviorType.REDIRECT) || this;
        var location = window.location;
        _this._targetUrl = targetUrl || location.protocol + "//" + location.hostname + location.pathname;
        _this._localState = localState || {};
        // Reject local state with reserved property.
        if (typeof _this._localState.__command !== 'undefined') {
            throw new Error('Invalid localState: Property \'__command\' is reserved');
        }
        return _this;
    }
    RedirectRequestBehavior.withLocalState = function (localState) {
        return new RedirectRequestBehavior(undefined, localState);
    };
    RedirectRequestBehavior.prototype.request = function (endpoint, command, args) {
        return __awaiter(this, void 0, void 0, function () {
            var origin, client, state;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        origin = RequestBehavior.getAllowedOrigin(endpoint);
                        client = new rpc_1.RedirectRpcClient(endpoint, origin);
                        return [4 /*yield*/, client.init()];
                    case 1:
                        _a.sent();
                        state = Object.assign({ __command: command }, this._localState);
                        console.log('state', state);
                        client.callAndSaveLocalState.apply(client, [this._targetUrl, state, command].concat(args));
                        return [2 /*return*/];
                }
            });
        });
    };
    return RedirectRequestBehavior;
}(RequestBehavior));
var PopupRequestBehavior = /** @class */ (function (_super) {
    __extends(PopupRequestBehavior, _super);
    function PopupRequestBehavior(options) {
        if (options === void 0) { options = PopupRequestBehavior.DEFAULT_OPTIONS; }
        var _this = _super.call(this, BehaviorType.POPUP) || this;
        _this._options = options;
        return _this;
    }
    PopupRequestBehavior.prototype.request = function (endpoint, command, args) {
        return __awaiter(this, void 0, void 0, function () {
            var origin, popup, client, result, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        origin = RequestBehavior.getAllowedOrigin(endpoint);
                        popup = this.createPopup(endpoint);
                        client = new rpc_1.PostMessageRpcClient(popup, origin);
                        return [4 /*yield*/, client.init()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, client.call.apply(client, [command].concat(args))];
                    case 3:
                        result = _a.sent();
                        client.close();
                        popup.close();
                        return [2 /*return*/, result];
                    case 4:
                        e_1 = _a.sent();
                        client.close();
                        popup.close();
                        throw e_1;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * @param {string} url
     * @returns {Window}
     */
    PopupRequestBehavior.prototype.createPopup = function (url) {
        var popup = window.open(url, 'NimiqAccounts', this._options);
        if (!popup) {
            throw new Error('Failed to open popup');
        }
        return popup;
    };
    PopupRequestBehavior.DEFAULT_OPTIONS = '';
    return PopupRequestBehavior;
}(RequestBehavior));
