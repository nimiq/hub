class RpcClient { // eslint-disable-line no-unused-vars
    /**
     * @param {Window} targetWindow
     * @param {string} targetOrigin
     * @returns {Promise<RpcClientInstance>}
     * @throws
     */
    static async create(targetWindow, targetOrigin) {
        return new Promise((resolve, reject) => {
            let connected = false;

            /**
             * @param {MessageEvent} message
             */
            const connectedListener = ({ source, origin, data }) => {
                if (source !== targetWindow
                    || data.status !== 'ok'
                    || data.result !== 'pong'
                    || data.id !== 1
                    || (targetOrigin !== '*' && origin !== targetOrigin)) return;

                // Debugging printouts
                if (data.result.stack) {
                    const error = new Error(data.result.message);
                    error.stack = data.result.stack;
                    console.error(error);
                }

                window.removeEventListener('message', connectedListener);

                connected = true;

                console.log('RpcClient: Connection established');
                resolve(new (RpcClient._generateClientClass(targetWindow, targetOrigin))());
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
                if (connected) {
                    clearTimeout(timeoutTimer);
                    return;
                }

                try {
                    targetWindow.postMessage({ command: 'ping', id: 1 }, targetOrigin);
                } catch (e) {
                    console.error(`postMessage failed: ${e}`);
                }

                // @ts-ignore
                connectTimer = setTimeout(tryToConnect, 1000);
            };

            // @ts-ignore
            connectTimer = setTimeout(tryToConnect, 100);
        });
    }


    /**
     * @param {Window} targetWindow
     * @param {string} targetOrigin
     * @returns {Newable}
     * @private
     */
    static _generateClientClass(targetWindow, targetOrigin) {
        /** @type {Map.<number,{resolve: Function, reject: Function}>} */
        const waitingRequests = new Map();

        /** @type {Newable} */
        const Client = class {
            constructor() {
                /** @type {Function} */
                this._receive = this._receive.bind(this);
                window.addEventListener('message', this._receive);
            }

            /**
             * @param {string} command
             * @param {any[]} [args]
             * @returns {Promise<any>}
             */
            async call(command, args) {
                return new Promise((resolve, reject) => {
                    const obj = {
                        command,
                        args,
                        id: this._generateRandomId(),
                    };

                    // Store the request resolvers
                    waitingRequests.set(obj.id, { resolve, reject });

                    console.debug('RpcClient REQUEST', command, args);

                    targetWindow.postMessage(obj, targetOrigin);
                });
            }

            /** */
            close() {
                window.removeEventListener('message', this._receive);
            }

            /**
             * @param {MessageEvent} message
             */
            _receive({ source, origin, data }) {
                // Discard all messages from unwanted sources
                // or which are not replies
                // or which are not from the correct origin
                if (source !== targetWindow
                    || !data.status
                    || !data.id
                    || (targetOrigin !== '*' && origin !== targetOrigin)) return;

                const callback = waitingRequests.get(data.id);

                if (callback) {
                    waitingRequests.delete(data.id);

                    console.debug('RpcClient RECEIVE', data);

                    if (data.status === 'ok') {
                        callback.resolve(data.result);
                    } else if (data.status === 'error') {
                        const { message, stack, code } = data.result;
                        const error = /** @type {CustomError} */ (new Error(message));
                        error.code = code;
                        error.stack = stack;
                        callback.reject(error);
                    }
                } else {
                    console.warn('Unknown RPC response:', data);
                }
            }

            _generateRandomId() {
                const array = new Uint32Array(1);
                crypto.getRandomValues(array);
                return array[0];
            }
        };

        return Client;
    }
}
