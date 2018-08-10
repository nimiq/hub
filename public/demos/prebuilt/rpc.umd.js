(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (factory((global.Rpc = {})));
}(this, (function (exports) { 'use strict';

    class RandomUtils {
        static generateRandomId() {
            const array = new Uint32Array(1);
            crypto.getRandomValues(array);
            return array[0];
        }
    }

    (function (ResponseStatus) {
        ResponseStatus["OK"] = "ok";
        ResponseStatus["ERROR"] = "error";
    })(exports.ResponseStatus || (exports.ResponseStatus = {}));

    /* tslint:disable:no-bitwise */
    class Base64 {
        // base64 is 4/3 + up to two characters of the original data
        static byteLength(b64) {
            const [validLength, placeHoldersLength] = Base64._getLengths(b64);
            return Base64._byteLength(validLength, placeHoldersLength);
        }
        static decode(b64) {
            Base64._initRevLookup();
            const [validLength, placeHoldersLength] = Base64._getLengths(b64);
            const arr = new Uint8Array(Base64._byteLength(validLength, placeHoldersLength));
            let curByte = 0;
            // if there are placeholders, only get up to the last complete 4 chars
            const len = placeHoldersLength > 0 ? validLength - 4 : validLength;
            let i = 0;
            for (; i < len; i += 4) {
                const tmp = (Base64._revLookup[b64.charCodeAt(i)] << 18) |
                    (Base64._revLookup[b64.charCodeAt(i + 1)] << 12) |
                    (Base64._revLookup[b64.charCodeAt(i + 2)] << 6) |
                    Base64._revLookup[b64.charCodeAt(i + 3)];
                arr[curByte++] = (tmp >> 16) & 0xFF;
                arr[curByte++] = (tmp >> 8) & 0xFF;
                arr[curByte++] = tmp & 0xFF;
            }
            if (placeHoldersLength === 2) {
                const tmp = (Base64._revLookup[b64.charCodeAt(i)] << 2) |
                    (Base64._revLookup[b64.charCodeAt(i + 1)] >> 4);
                arr[curByte++] = tmp & 0xFF;
            }
            if (placeHoldersLength === 1) {
                const tmp = (Base64._revLookup[b64.charCodeAt(i)] << 10) |
                    (Base64._revLookup[b64.charCodeAt(i + 1)] << 4) |
                    (Base64._revLookup[b64.charCodeAt(i + 2)] >> 2);
                arr[curByte++] = (tmp >> 8) & 0xFF;
                arr[curByte /*++ not needed*/] = tmp & 0xFF;
            }
            return arr;
        }
        static encode(uint8) {
            const length = uint8.length;
            const extraBytes = length % 3; // if we have 1 byte left, pad 2 bytes
            const parts = [];
            const maxChunkLength = 16383; // must be multiple of 3
            // go through the array every three bytes, we'll deal with trailing stuff later
            for (let i = 0, len2 = length - extraBytes; i < len2; i += maxChunkLength) {
                parts.push(Base64._encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
            }
            // pad the end with zeros, but make sure to not forget the extra bytes
            if (extraBytes === 1) {
                const tmp = uint8[length - 1];
                parts.push(Base64._lookup[tmp >> 2] +
                    Base64._lookup[(tmp << 4) & 0x3F] +
                    '==');
            }
            else if (extraBytes === 2) {
                const tmp = (uint8[length - 2] << 8) + uint8[length - 1];
                parts.push(Base64._lookup[tmp >> 10] +
                    Base64._lookup[(tmp >> 4) & 0x3F] +
                    Base64._lookup[(tmp << 2) & 0x3F] +
                    '=');
            }
            return parts.join('');
        }
        static encodeUrl(buffer) {
            return Base64.encode(buffer).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '.');
        }
        static decodeUrl(base64) {
            return Base64.decode(base64.replace(/_/g, '/').replace(/-/g, '+').replace(/\./g, '='));
        }
        static _initRevLookup() {
            if (Base64._revLookup.length !== 0)
                return;
            Base64._revLookup = [];
            for (let i = 0, len = Base64._lookup.length; i < len; i++) {
                Base64._revLookup[Base64._lookup.charCodeAt(i)] = i;
            }
            // Support decoding URL-safe base64 strings, as Node.js does.
            // See: https://en.wikipedia.org/wiki/Base64#URL_applications
            Base64._revLookup['-'.charCodeAt(0)] = 62;
            Base64._revLookup['_'.charCodeAt(0)] = 63;
        }
        static _getLengths(b64) {
            const length = b64.length;
            if (length % 4 > 0) {
                throw new Error('Invalid string. Length must be a multiple of 4');
            }
            // Trim off extra bytes after placeholder bytes are found
            // See: https://github.com/beatgammit/base64-js/issues/42
            let validLength = b64.indexOf('=');
            if (validLength === -1)
                validLength = length;
            const placeHoldersLength = validLength === length ? 0 : 4 - (validLength % 4);
            return [validLength, placeHoldersLength];
        }
        static _byteLength(validLength, placeHoldersLength) {
            return ((validLength + placeHoldersLength) * 3 / 4) - placeHoldersLength;
        }
        static _tripletToBase64(num) {
            return Base64._lookup[num >> 18 & 0x3F] +
                Base64._lookup[num >> 12 & 0x3F] +
                Base64._lookup[num >> 6 & 0x3F] +
                Base64._lookup[num & 0x3F];
        }
        static _encodeChunk(uint8, start, end) {
            const output = [];
            for (let i = start; i < end; i += 3) {
                const tmp = ((uint8[i] << 16) & 0xFF0000) +
                    ((uint8[i + 1] << 8) & 0xFF00) +
                    (uint8[i + 2] & 0xFF);
                output.push(Base64._tripletToBase64(tmp));
            }
            return output.join('');
        }
    }
    Base64._lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    Base64._revLookup = [];

    var ExtraJSONTypes;
    (function (ExtraJSONTypes) {
        ExtraJSONTypes[ExtraJSONTypes["UINT8_ARRAY"] = 0] = "UINT8_ARRAY";
    })(ExtraJSONTypes || (ExtraJSONTypes = {}));
    class JSONUtils {
        static stringify(value) {
            return JSON.stringify(value, JSONUtils._jsonifyType);
        }
        static parse(value) {
            return JSON.parse(value, JSONUtils._parseType);
        }
        static _parseType(key, value) {
            if (value && value.hasOwnProperty &&
                value.hasOwnProperty(JSONUtils.TYPE_SYMBOL) && value.hasOwnProperty(JSONUtils.VALUE_SYMBOL)) {
                switch (value[JSONUtils.TYPE_SYMBOL]) {
                    case ExtraJSONTypes.UINT8_ARRAY:
                        return Base64.decode(value[JSONUtils.VALUE_SYMBOL]);
                }
            }
            return value;
        }
        static _jsonifyType(key, value) {
            if (value instanceof Uint8Array) {
                return JSONUtils._typedObject(ExtraJSONTypes.UINT8_ARRAY, Base64.encode(value));
            }
            return value;
        }
        static _typedObject(type, value) {
            const obj = {};
            obj[JSONUtils.TYPE_SYMBOL] = type;
            obj[JSONUtils.VALUE_SYMBOL] = value;
            return obj;
        }
    }
    JSONUtils.TYPE_SYMBOL = '__';
    JSONUtils.VALUE_SYMBOL = 'v';

    class RequestIdStorage {
        /**
         * @param {boolean} [storeState=true] Whether to store state in sessionStorage
         */
        constructor(storeState = true) {
            this._store = storeState ? window.sessionStorage : null;
            this._validIds = new Map();
            if (storeState) {
                this._restoreIds();
            }
        }
        static _decodeIds(ids) {
            const obj = JSONUtils.parse(ids);
            const validIds = new Map();
            for (const key of Object.keys(obj)) {
                const integerKey = parseInt(key, 10);
                validIds.set(isNaN(integerKey) ? key : integerKey, obj[key]);
            }
            return validIds;
        }
        has(id) {
            return this._validIds.has(id);
        }
        getCommand(id) {
            const result = this._validIds.get(id);
            return result ? result[0] : null;
        }
        getState(id) {
            const result = this._validIds.get(id);
            return result ? result[1] : null;
        }
        add(id, command, state = null) {
            this._validIds.set(id, [command, state]);
            this._storeIds();
        }
        remove(id) {
            this._validIds.delete(id);
            this._storeIds();
        }
        clear() {
            this._validIds.clear();
            if (this._store) {
                this._store.removeItem(RequestIdStorage.KEY);
            }
        }
        _encodeIds() {
            const obj = Object.create(null);
            for (const [key, value] of this._validIds) {
                obj[key] = value;
            }
            return JSONUtils.stringify(obj);
        }
        _restoreIds() {
            const requests = this._store.getItem(RequestIdStorage.KEY);
            if (requests) {
                this._validIds = RequestIdStorage._decodeIds(requests);
            }
        }
        _storeIds() {
            if (this._store) {
                this._store.setItem(RequestIdStorage.KEY, this._encodeIds());
            }
        }
    }
    RequestIdStorage.KEY = 'rpcRequests';

    class UrlRpcEncoder {
        static receiveRedirectCommand(url) {
            // Need referrer for origin check
            if (!document.referrer)
                return null;
            // Parse query
            const params = new URLSearchParams(url.search);
            const referrer = new URL(document.referrer);
            // Ignore messages without a command
            if (!params.has('command'))
                return null;
            // Ignore messages without an ID
            if (!params.has('id'))
                return null;
            // Ignore messages without a valid return path
            if (!params.has('returnURL'))
                return null;
            // Only allow returning to same origin
            const returnURL = new URL(params.get('returnURL'));
            if (returnURL.origin !== referrer.origin)
                return null;
            // Parse args
            let args = [];
            if (params.has('args')) {
                try {
                    args = JSONUtils.parse(params.get('args'));
                }
                catch (e) {
                    // Do nothing
                }
            }
            args = Array.isArray(args) ? args : [];
            return {
                origin: referrer.origin,
                data: {
                    id: parseInt(params.get('id'), 10),
                    command: params.get('command'),
                    args,
                },
                returnURL: params.get('returnURL'),
            };
        }
        /**
         * @param {URL|Location} url
         * @return {{origin:string, data:{id:number, status:string, result:*}}}
         */
        static receiveRedirectResponse(url) {
            // Need referrer for origin check
            if (!document.referrer)
                return null;
            // Parse query
            const params = new URLSearchParams(url.search);
            const referrer = new URL(document.referrer);
            // Ignore messages without a status
            if (!params.has('status'))
                return null;
            // Ignore messages without an ID
            if (!params.has('id'))
                return null;
            // Ignore messages without a result
            if (!params.has('result'))
                return null;
            // Parse result
            const result = JSONUtils.parse(params.get('result'));
            const status = params.get('status') === exports.ResponseStatus.OK ? exports.ResponseStatus.OK : exports.ResponseStatus.ERROR;
            return {
                origin: referrer.origin,
                data: {
                    id: parseInt(params.get('id'), 10),
                    status,
                    result,
                },
            };
        }
        static prepareRedirectReply(state, status, result) {
            const params = new URLSearchParams();
            params.set('status', status);
            params.set('result', JSONUtils.stringify(result));
            params.set('id', state.id.toString());
            // TODO: what if it already includes a query string
            return `${state.returnURL}?${params.toString()}`;
        }
        static prepareRedirectInvocation(targetURL, id, returnURL, command, args) {
            const params = new URLSearchParams();
            params.set('id', id.toString());
            params.set('returnURL', returnURL);
            params.set('command', command);
            if (Array.isArray(args)) {
                params.set('args', JSONUtils.stringify(args));
            }
            // TODO: what if it already includes a query string
            return `${targetURL}?${params.toString()}`;
        }
    }

    class RpcClient {
        constructor(allowedOrigin, storeState = false) {
            this._allowedOrigin = allowedOrigin;
            this._waitingRequests = new RequestIdStorage(storeState);
            this._responseHandlers = new Map();
        }
        onResponse(command, resolve, reject) {
            this._responseHandlers.set(command, { resolve, reject });
        }
        _receive(message) {
            // Discard all messages from unwanted sources
            // or which are not replies
            // or which are not from the correct origin
            if (!message.data
                || !message.data.status
                || !message.data.id
                || (this._allowedOrigin !== '*' && message.origin !== this._allowedOrigin))
                return;
            const data = message.data;
            // Response handlers by id have priority to more general ones by command
            let callback;
            if (this._responseHandlers.has(data.id)) {
                callback = this._responseHandlers.get(data.id);
            }
            else {
                const command = this._waitingRequests.getCommand(data.id);
                if (command) {
                    callback = this._responseHandlers.get(command);
                }
            }
            const state = this._waitingRequests.getState(data.id);
            if (callback) {
                this._waitingRequests.remove(data.id);
                console.debug('RpcClient RECEIVE', data);
                if (data.status === exports.ResponseStatus.OK) {
                    callback.resolve(data.result, data.id, state);
                }
                else if (data.status === 'error') {
                    const error = new Error(data.result.message);
                    if (data.result.stack) {
                        error.stack = data.result.stack;
                    }
                    callback.reject(error, data.id, state);
                }
            }
            else {
                console.warn('Unknown RPC response:', data);
            }
        }
    }
    class PostMessageRpcClient extends RpcClient {
        constructor(targetWindow, allowedOrigin) {
            super(allowedOrigin);
            this._target = targetWindow;
            this._connected = false;
            this._receiveListener = this._receive.bind(this);
        }
        async init() {
            await this._connect();
            window.addEventListener('message', this._receiveListener);
        }
        async call(command, ...args) {
            if (!this._connected)
                throw new Error('Client is not connected, call init first');
            return new Promise((resolve, reject) => {
                const obj = {
                    command,
                    args,
                    id: RandomUtils.generateRandomId(),
                };
                // Store the request resolvers
                this._responseHandlers.set(obj.id, { resolve, reject });
                this._waitingRequests.add(obj.id, command);
                console.debug('RpcClient REQUEST', command, args);
                this._target.postMessage(obj, this._allowedOrigin);
            });
        }
        close() {
            window.removeEventListener('message', this._receiveListener);
        }
        _connect() {
            return new Promise((resolve, reject) => {
                /**
                 * @param {MessageEvent} message
                 */
                const connectedListener = (message) => {
                    const { source, origin, data } = message;
                    if (source !== this._target
                        || data.status !== exports.ResponseStatus.OK
                        || data.result !== 'pong'
                        || data.id !== 1
                        || (this._allowedOrigin !== '*' && origin !== this._allowedOrigin))
                        return;
                    // Debugging printouts
                    if (data.result.stack) {
                        const error = new Error(data.result.message);
                        error.stack = data.result.stack;
                        console.error(error);
                    }
                    window.removeEventListener('message', connectedListener);
                    this._connected = true;
                    console.log('RpcClient: Connection established');
                    window.addEventListener('message', this._receiveListener);
                    resolve(true);
                };
                window.addEventListener('message', connectedListener);
                let connectTimer = 0;
                const timeoutTimer = setTimeout(() => {
                    window.removeEventListener('message', connectedListener);
                    clearTimeout(connectTimer);
                    reject(new Error('Connection timeout'));
                }, 10 * 1000);
                /**
                 * Send 'ping' command every second, until cancelled
                 */
                const tryToConnect = () => {
                    if (this._connected) {
                        clearTimeout(timeoutTimer);
                        return;
                    }
                    try {
                        this._target.postMessage({ command: 'ping', id: 1 }, this._allowedOrigin);
                    }
                    catch (e) {
                        console.error(`postMessage failed: ${e}`);
                    }
                    // @ts-ignore
                    connectTimer = setTimeout(tryToConnect, 1000);
                };
                // @ts-ignore
                connectTimer = setTimeout(tryToConnect, 100);
            });
        }
    }
    class RedirectRpcClient extends RpcClient {
        constructor(targetURL, allowedOrigin) {
            super(allowedOrigin, /*storeState*/ true);
            this._target = targetURL;
        }
        async init() {
            const message = UrlRpcEncoder.receiveRedirectResponse(window.location);
            if (message) {
                this._receive(message);
            }
        }
        /* tslint:disable:no-empty */
        close() { }
        call(returnURL, command, ...args) {
            this.callAndSaveLocalState(returnURL, null, command, ...args);
        }
        callAndSaveLocalState(returnURL, state, command, ...args) {
            const id = RandomUtils.generateRandomId();
            const url = UrlRpcEncoder.prepareRedirectInvocation(this._target, id, returnURL, command, args);
            this._waitingRequests.add(id, command, state);
            console.debug('RpcClient REQUEST', command, args);
            window.location.href = url;
        }
    }

    class State {
        get id() {
            return this._id;
        }
        get origin() {
            return this._origin;
        }
        get data() {
            return this._data;
        }
        get returnURL() {
            return this._returnURL;
        }
        static fromJSON(json) {
            const obj = JSON.parse(json);
            return new State(obj);
        }
        constructor(message) {
            if (!message.data.id)
                throw Error('Missing id');
            this._origin = message.origin;
            this._id = message.data.id;
            this._postMessage = 'source' in message && !('returnURL' in message);
            this._returnURL = 'returnURL' in message ? message.returnURL : null;
            this._data = message.data;
            this._source = 'source' in message ? message.source : null;
        }
        toJSON() {
            const obj = {
                origin: this._origin,
                data: this._data,
            };
            if (this._postMessage) {
                if (this._source === window.opener) {
                    obj.source = 'opener';
                }
                else if (this._source === window.parent) {
                    obj.source = 'parent';
                }
                else {
                    obj.source = null;
                }
            }
            else {
                obj.returnURL = this._returnURL;
            }
            return JSON.stringify(obj);
        }
        reply(status, result) {
            console.debug('RpcServer REPLY', result);
            if (this._postMessage) {
                // Send via postMessage (e.g., popup)
                let target;
                // If source is given, choose accordingly
                if (this._source) {
                    if (this._source === 'opener') {
                        target = window.opener;
                    }
                    else if (this._source === 'parent') {
                        target = window.parent;
                    }
                    else {
                        target = this._source;
                    }
                }
                else {
                    // Else guess
                    target = window.opener || window.parent;
                }
                target.postMessage({
                    status,
                    result,
                    id: this.id,
                }, this.origin);
            }
            else if (this._returnURL) {
                // Send via top-level navigation
                window.location.href = UrlRpcEncoder.prepareRedirectReply(this, status, result);
            }
        }
    }

    class RpcServer {
        static _ok(state, result) {
            state.reply(exports.ResponseStatus.OK, result);
        }
        static _error(state, error) {
            state.reply(exports.ResponseStatus.ERROR, error.message
                ? { message: error.message, stack: error.stack }
                : { message: error });
        }
        constructor(allowedOrigin) {
            this._allowedOrigin = allowedOrigin;
            this._responseHandlers = new Map();
            this._responseHandlers.set('ping', () => 'pong');
            this._receiveListener = this._receive.bind(this);
        }
        onRequest(command, fn) {
            this._responseHandlers.set(command, fn);
        }
        init() {
            window.addEventListener('message', this._receiveListener);
            this._receiveRedirect();
        }
        close() {
            window.removeEventListener('message', this._receiveListener);
        }
        _receiveRedirect() {
            const message = UrlRpcEncoder.receiveRedirectCommand(window.location);
            if (message) {
                this._receive(message);
            }
        }
        _receive(message) {
            let state = null;
            try {
                state = new State(message);
                // Cannot reply to a message that has no source window or return URL
                if (!('source' in message) && !('returnURL' in message))
                    return;
                // Ignore messages without a command
                if (!('command' in state.data)) {
                    return;
                }
                if (this._allowedOrigin !== '*' && message.origin !== this._allowedOrigin) {
                    throw new Error('Unauthorized');
                }
                const args = message.data.args && Array.isArray(message.data.args) ? message.data.args : [];
                // Test if request calls a valid handler with the correct number of arguments
                if (!this._responseHandlers.has(state.data.command)) {
                    throw new Error(`Unknown command: ${state.data.command}`);
                }
                const requestedMethod = this._responseHandlers.get(state.data.command);
                // Do not include state argument
                if (Math.max(requestedMethod.length - 1, 0) < args.length) {
                    throw new Error(`Too many arguments passed: ${message}`);
                }
                console.debug('RpcServer ACCEPT', state.data);
                // Call method
                const result = requestedMethod(state, ...args);
                // If a value is returned, we take care of the reply,
                // otherwise we assume the handler to do the reply when appropriate.
                if (result instanceof Promise) {
                    result
                        .then((finalResult) => {
                        if (finalResult !== undefined) {
                            RpcServer._ok(state, finalResult);
                        }
                    })
                        .catch((error) => RpcServer._error(state, error));
                }
                else if (result !== undefined) {
                    RpcServer._ok(state, result);
                }
            }
            catch (error) {
                if (state) {
                    RpcServer._error(state, error);
                }
            }
        }
    }

    exports.RpcClient = RpcClient;
    exports.PostMessageRpcClient = PostMessageRpcClient;
    exports.RedirectRpcClient = RedirectRpcClient;
    exports.RpcServer = RpcServer;
    exports.State = State;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
