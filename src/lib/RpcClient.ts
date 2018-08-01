import CustomError from './CustomError';

export default class RpcClient {
    public static async create(targetWindow: Window, targetOrigin: string) {
        return new Promise((resolve, reject) => {
            let connected = false;

            const connectedListener = ({ source, origin, data }: MessageEvent) => {
                if (source !== targetWindow
                    || data.status !== 'ok'
                    || data.result !== 'pong'
                    || data.id !== 1
                    || (targetOrigin !== '*' && origin !== targetOrigin)) return;

                window.removeEventListener('message', connectedListener);

                connected = true;

                console.log('RpcClient: Connection established');
                const ClientClass = RpcClient._generateClientClass(targetWindow, targetOrigin);
                const instance = new ClientClass();
                resolve(instance);
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


    private static _generateClientClass(targetWindow: Window, targetOrigin: string) {
        interface Request {
            resolve: (value?: any) => void;
            reject: (reason?: any) => void;
        }

        const waitingRequests = new Map<number, Request>();

        return class {
            constructor() {
                this._receive = this._receive.bind(this);
                window.addEventListener('message', this._receive);
            }

            public async call(command: string, args: any[]) {
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

            public close() {
                window.removeEventListener('message', this._receive);
            }

            private _receive({ source, origin, data }: MessageEvent) {
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
                        const error = new Error(message) as CustomError;
                        error.code = code;
                        error.stack = stack;
                        callback.reject(error);
                    }
                } else {
                    console.warn('Unknown RPC response:', data);
                }
            }

            private _generateRandomId() {
                const array = new Uint32Array(1);
                crypto.getRandomValues(array);
                return array[0];
            }
        };
    }
}
