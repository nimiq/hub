import {RedirectRpcClient} from '@nimiq/rpc';
import {RequestBehavior} from '@/lib/keyguard/RequestBehavior';
import {
    KeyguardCommand,
    SignMessageResult,
    SignTransactionRequest,
    SignTransactionResult,
    SignMessageRequest,
} from '@/lib/keyguard/RequestTypes';

export class KeyguardClient {
    private static readonly DEFAULT_ENDPOINT = 'http://localhost:8000/src';

    private readonly _endpoint: string;
    private _redirectClient: RedirectRpcClient;
    private _observable: Nimiq.Observable;
    private _defaultBehavior: RequestBehavior;

    constructor(endpoint = KeyguardClient.DEFAULT_ENDPOINT, defaultBehavior?: RequestBehavior) {
        this._endpoint = endpoint;
        this._defaultBehavior = defaultBehavior || new RequestBehavior();

        this._redirectClient = new RedirectRpcClient('', RequestBehavior.getAllowedOrigin(this._endpoint));
        this._redirectClient.onResponse('request', this._onResolve.bind(this), this._onReject.bind(this));

        this._observable = new Nimiq.Observable();
    }

    public init() {
        return this._redirectClient.init();
    }

    public on(command: KeyguardCommand, resolve: (...args: any[]) => any, reject: (...args: any[]) => any) {
        this._observable.on(`${command}-resolve`, resolve);
        this._observable.on(`${command}-reject`, reject);
    }

    public create(defaultKeyPath: string, requestBehavior = this._defaultBehavior) {
        return this._request(requestBehavior,  KeyguardCommand.CREATE, [{ defaultKeyPath }]);
    }

    public remove(keyId: string, requestBehavior = this._defaultBehavior) {
        return this._request(requestBehavior,  KeyguardCommand.REMOVE, [{ keyId }]);
    }

    public importWords(defaultKeyPath: string, requestBehavior = this._defaultBehavior) {
        return this._request(requestBehavior,  KeyguardCommand.IMPORT_WORDS, [{ defaultKeyPath }]);
    }

    public importFile(requestBehavior = this._defaultBehavior) {
        return this._request(requestBehavior,  KeyguardCommand.IMPORT_FILE, []);
    }

    public async exportWords(keyId: string, requestBehavior = this._defaultBehavior) {
        return this._request(requestBehavior,  KeyguardCommand.EXPORT_WORDS, [{ keyId }]);
    }

    public async exportFile(keyId: string, requestBehavior = this._defaultBehavior) {
        return this._request(requestBehavior,  KeyguardCommand.EXPORT_FILE, [{ keyId }]);
    }

    public async signTransaction(request: SignTransactionRequest,
                                 requestBehavior = this._defaultBehavior):Promise<SignTransactionResult> {
        return this._request(requestBehavior,  KeyguardCommand.SIGN_TRANSACTION, [request]);
    }

    public async signMessage(request: SignMessageRequest,
                             requestBehavior = this._defaultBehavior): Promise<SignMessageResult> {
        return this._request(requestBehavior,  KeyguardCommand.SIGN_MESSAGE, [request]);
    }

    /* PRIVATE METHODS */

    private _request(behavior: RequestBehavior, command: KeyguardCommand, args: any[]): Promise<any> {
        return behavior.request(this._endpoint, command, args);
    }

    private _onReject(error: any, id: number, state: any) {
        const command = state.__command;
        if (!command) {
            throw new Error('Invalid state after RPC request');
        }
        delete state.__command;

        this._observable.fire(`${command}-reject`, error, state);
    }

    private _onResolve(result: any, id: number, state: any) {
        const command = state.__command;
        if (!command) {
            throw new Error('Invalid state after RPC request');
        }
        delete state.__command;

        this._observable.fire(`${command}-resolve`, result, state);
    }
}
