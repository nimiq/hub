// Some notes about the behaviour of the ledger:
// - The ledger only supports one call at a time.
// - If the browser doesn't support U2F, an exception gets thrown ("U2F browser support is needed for Ledger")
// - Firefox' implementation of U2F (when enabled in about:config) does not seem to be compatible with ledger and
//   throws "U2F DEVICE_INELIGIBLE"
// - The browsers U2F API has a timeout after which the call fails in the browser. The timeout is about 30s
// - The Nimiq Ledger App avoids timeouts by keeping the call alive via a heartbeat when the Ledger is connected and the
//   app opened. However when the Ledger is not connected or gets disconnected, timeouts still occur.
// - If the ledger is locked while the nimiq app (or another app throwing that same exception) was running, a "dongle
//   locked" exception gets thrown. It does however not get thrown when the ledger was just being connected or when
//   the ledger locks on the homescreen. (If I remember correctly, need to verify again).
// - If the ledger is busy with another call it throws an exception that it is busy. The ledger API however only knows,
//   if the ledger is busy by another call from this same page (and same API instance?).
// - If we make another call while the other call is still ongoing and the ledger not detected as being busy, the
//   heartbeat breaks and a timeout occurs.
// - Requests that were cancelled via request.cancel() are not actually cancelled on the ledger and keep the ledger
//   busy until the request times out or the user confirms/declines.
// - If the ledger locks during a signTransaction request and the "dongle locked" exception gets thrown after some while
//   and the user then unlocks the ledger again, the request data is gone or not displayed (amount, recipient, fee,
//   network, extra data etc). If the user then rejects/confirms, the ledger freezes and can not be unfrozen. This does
//   not occur with this api, as the api replaces that call after unlock.
//
// Notes about app versions < 1.4.1 / 1.4.0:
// - App versions < 1.4.0 are incompatible with Chrome 72+, see https://github.com/LedgerHQ/ledgerjs/issues/306.
// - App versions < 1.4.1 are incompatible with Chrome 72-73
//
// Notes about app versions < 1.3.1:
// - Versions < 1.3.1 did not have a heartbeat to avoid timeouts
// - For requests with display on the ledger, the ledger keeps displaying the request even if it timed out. When the
//   user confirms or declines that request after the timeout the ledger ignores that and freezes on second press.
// - After a request timed out, it is possible to send a new request to the ledger essentially replacing the old
//   request. If the ledger is still displaying the UI from the previous timed out request and the new request also has
//   a UI, the old UI also gets replaced. The animation of the new request starts at the beginning.
// - Although a previous request can be replaced immediately after the timeout exception (no device busy exception gets
//   thrown and the UI gets replaced), the buttons still seem to be assigned to the previous request if there is no
//   wait time between the requests. Wait time <1s is too short. Wait times between 1s and 1.5s behave strange as the
//   old request doesn't get replaced at all. 1.5s seems to be reliable. At that time, the signTransaction UI also
//   forms a nice loop with the replaced UI.
// - If the user confirms or declines during the wait time nothing happens (or freeze at second button press) which
//   is a bad user experience but there is nothing we can do about it.
// - If the ledger froze, it gets unfrozen by sending a new request. If the request has a UI, the UI gets displayed,
//   otherwise the Nimiq app gets displayed. If the user confirms the new request, the app afterwards behaves normal.
//   If he declines the request though, any request afterwards seems to time out and the nimiq ledger app needs to be
//   restarted. This is a corner case that is not covered in this api.

// The following flows should be tested if changing this code:
// - ledger not connected yet
// - ledger connected
// - ledger was connected but relocked
// - ledger connected but in another app
// - ledger connected but with old app version
// - connect timed out
// - request timed out
// - user approved action on Ledger
// - user denied action on Ledger
// - user cancel in UI
// - user cancel and immediately make another request
// - ledger already handling another request (from another tab)

// tslint:disable-next-line:max-line-length
// TODO: move to own repository:
// - change implementation to be flow typed and integrate with ledger provided flow libraries directly.
// - use an appropriate ledger transport library (u2f, WebAuthn, WebUSB, WebBluetooth) depending on platform
// - Also, the verification and address computation in ledgerjs should be done by Nimiq's crypto methods instead of
//   unnecessarily bundling tweetnacl and blakejs.
import Observable = Nimiq.Observable;

type LedgerJs = any;
// tslint:disable-next-line:variable-name no-var-requires
const LedgerJs: LedgerJs = require('@nimiq/ledgerjs/ledgerjs-nimiq.min.js');

type LedgerApiListener = (...args: any[]) => void;

interface TransactionInfo {
    sender: Nimiq.Address;
    senderType?: Nimiq.Account.Type;
    recipient: Nimiq.Address;
    recipientType?: Nimiq.Account.Type;
    value: number; // In Luna
    fee?: number;
    validityStartHeight: number;
    network?: 'main' | 'test' | 'dev';
    flags?: number;
    extraData?: Uint8Array;
}

class LedgerApiRequest<T> extends Observable {
    public static readonly EVENT_CANCEL = 'cancel';
    public readonly type: LedgerApi.RequestType;
    public readonly params: LedgerApi.RequestParams;
    private readonly _call: (api: LedgerJs, params: LedgerApi.RequestParams) => Promise<T>;
    private _cancelled: boolean = false;
    private _finished: boolean = false;

    constructor(type: LedgerApi.RequestType,
                call: (api: LedgerJs, params: LedgerApi.RequestParams) => Promise<T>,
                params: LedgerApi.RequestParams) {
        super();
        this.type = type;
        this._call = call;
        this.params = params;
    }

    public get cancelled(): boolean {
        return this._cancelled;
    }

    public async call(api: LedgerJs): Promise<T> {
        const result = await this._call.call(this, api, this.params);
        this._finished = true;
        return result;
    }

    public cancel(): void {
        this._cancelled = true;
        this.fire(LedgerApiRequest.EVENT_CANCEL);
    }

    public on(type: string, callback: (...args: any[]) => any): number {
        if (type === LedgerApiRequest.EVENT_CANCEL && this._cancelled) {
            // trigger callback directly
            callback();
        }
        return super.on(type, callback);
    }
}

class LedgerApi {
    // public fields and methods
    public static readonly BIP32_BASE_PATH = `44'/242'/0'/`;
    public static readonly BIP32_PATH_REGEX = new RegExp(`^${LedgerApi.BIP32_BASE_PATH}(\\d+)'$`);
    public static readonly MIN_REQUIRED_APP_VERSION = [1, 4, 1];
    public static readonly WAIT_TIME_AFTER_TIMEOUT = 1500;
    public static readonly WAIT_TIME_AFTER_ERROR = 500;

    public static get currentState(): LedgerApi.State {
        return LedgerApi._currentState;
    }

    public static get currentRequest(): LedgerApiRequest<any> | null {
        return LedgerApi._currentRequest;
    }

    public static get isBusy(): boolean {
        return !!LedgerApi._currentRequest;
    }

    /**
     * Get the 32 byte walletId of the currently connected ledger as base64.
     * If no ledger is connected, it waits for one to be connected.
     * Throws, if the request is cancelled.
     *
     * If currently a request to the ledger is in process, this call does not require an additional
     * request to the Ledger. Thus, if you want to know the walletId in conjunction with another
     * request, try to call this method after initiating the other request but before it finishes.
     */
    public static async getWalletId(): Promise<string> {
        if (LedgerApi._currentlyConnectedWalletId) return LedgerApi._currentlyConnectedWalletId;
        // we have to wait for connection of ongoing request or initiate a call ourselves
        if (LedgerApi.isBusy) {
            // already a request going on. Just wait for it to connect.
            return new Promise<string>((resolve, reject) => {
                const onConnect = (walletId: string) => {
                    LedgerApi.off(LedgerApi.EventType.CONNECTED, onConnect);
                    LedgerApi.off(LedgerApi.EventType.REQUEST_CANCELLED, onCancel);
                    resolve(walletId);
                };
                const onCancel = () => {
                    LedgerApi.off(LedgerApi.EventType.CONNECTED, onConnect);
                    LedgerApi.off(LedgerApi.EventType.REQUEST_CANCELLED, onCancel);
                    reject();
                };
                LedgerApi.on(LedgerApi.EventType.CONNECTED, onConnect);
                LedgerApi.on(LedgerApi.EventType.REQUEST_CANCELLED, onCancel);
            });
        } else {
            const request = new LedgerApiRequest(LedgerApi.RequestType.GET_WALLET_ID,
                (): Promise<string> => {
                    // we're connected when the request get's executed
                    return Promise.resolve(LedgerApi._currentlyConnectedWalletId!);
                },
                {},
            );
            return LedgerApi._callLedger(request);
        }
    }

    public static on(eventType: LedgerApi.EventType, listener: LedgerApiListener): void {
        if (!LedgerApi._listeners.has(eventType)) {
            LedgerApi._listeners.set(eventType, [listener]);
        } else {
            LedgerApi._listeners.get(eventType)!.push(listener);
        }
    }

    public static off(eventType: LedgerApi.EventType, listener: LedgerApiListener): void {
        const listenersForEvent = LedgerApi._listeners.get(eventType);
        if (!listenersForEvent) return;
        const index = listenersForEvent.indexOf(listener);
        if (index === -1) return;
        listenersForEvent.splice(index, 1);
    }

    public static once(eventType: LedgerApi.EventType, listener: LedgerApiListener): void {
        const onceListener: LedgerApiListener = ((...args: any[]) => {
            LedgerApi.off(eventType, onceListener);
            listener(...args);
        });
        LedgerApi.on(eventType, onceListener);
    }

    public static getBip32PathForKeyId(keyId: number): string {
        return `${LedgerApi.BIP32_BASE_PATH}${keyId}'`;
    }

    public static getKeyIdForBip32Path(path: string): number | null {
        const pathMatch = LedgerApi.BIP32_PATH_REGEX.exec(path);
        if (!pathMatch) return null;
        return parseInt(pathMatch[pathMatch.length - 1], 10);
    }

    public static async deriveAccounts(pathsToDerive: Iterable<string>, walletId?: string)
        : Promise<Array<{ address: string, keyPath: string }>> {
        const request = new LedgerApiRequest(LedgerApi.RequestType.DERIVE_ACCOUNTS,
            async (api, params): Promise<Array<{ address: string, keyPath: string }>> => {
                const accounts = [];
                for (const keyPath of params.pathsToDerive!) {
                    if (request.cancelled) return accounts;
                    accounts.push({
                        address: (await api.getAddress(keyPath, /*validate*/ true, /*display*/ false)).address,
                        keyPath,
                    });
                }
                return accounts;
            },
            {
                walletId,
                pathsToDerive,
            },
        );
        // check paths outside of request to avoid endless loop in _callLedger if we'd throw for an invalid keyPath
        for (const keyPath of pathsToDerive) {
            if (LedgerApi.BIP32_PATH_REGEX.test(keyPath)) continue;
            this._throwError(LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED, `Invalid keyPath ${keyPath}`, request);
        }
        return LedgerApi._callLedger(request);
    }

    public static async getPublicKey(keyPath: string, walletId?: string): Promise<Uint8Array> {
        const request = new LedgerApiRequest(LedgerApi.RequestType.GET_PUBLIC_KEY,
            async (api, params): Promise<Uint8Array> => {
                const result = await api.getPublicKey(params.keyPath, /*validate*/ true, /*display*/ false);
                return result.publicKey;
            },
            {
                walletId,
                keyPath,
            },
        );
        if (!LedgerApi.BIP32_PATH_REGEX.test(keyPath)) {
            this._throwError(LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED, `Invalid keyPath ${keyPath}`, request);
        }
        return LedgerApi._callLedger(request);
    }

    public static async getAddress(keyPath: string, walletId?: string): Promise<string> {
        const request = new LedgerApiRequest(LedgerApi.RequestType.GET_ADDRESS,
            async (api, params): Promise<string> => {
                const result = await api.getAddress(params.keyPath, /*validate*/ true, /*display*/ false);
                return result.address;
            },
            {
                walletId,
                keyPath,
            },
        );
        if (!LedgerApi.BIP32_PATH_REGEX.test(keyPath)) {
            this._throwError(LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED, `Invalid keyPath ${keyPath}`, request);
        }
        return LedgerApi._callLedger(request);
    }

    public static async confirmAddress(userFriendlyAddress: string, keyPath: string, walletId?: string)
        : Promise<string> {
        const request = new LedgerApiRequest(LedgerApi.RequestType.CONFIRM_ADDRESS,
            async (api, params): Promise<string> => {
                const result = await api.getAddress(params.keyPath, /*validate*/ true, /*display*/ true);
                const confirmedAddress = result.address;

                if (params.addressToConfirm!.replace(/ /g, '').toUpperCase()
                    !== confirmedAddress.replace(/ /g, '').toUpperCase()) {
                    LedgerApi._throwError(LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED, 'Address mismatch', request);
                }

                return confirmedAddress;
            },
            {
                walletId,
                keyPath,
                addressToConfirm: userFriendlyAddress,
            },
        );
        if (!LedgerApi.BIP32_PATH_REGEX.test(keyPath)) {
            this._throwError(LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED, `Invalid keyPath ${keyPath}`, request);
        }
        return LedgerApi._callLedger(request);
    }

    public static async getConfirmedAddress(keyPath: string, walletId?: string): Promise<string> {
        const address = await LedgerApi.getAddress(keyPath, walletId);
        return await this.confirmAddress(address, keyPath, walletId);
    }

    public static async signTransaction(transaction: TransactionInfo, keyPath: string, walletId?: string)
        : Promise<Nimiq.Transaction> {
        const request = new LedgerApiRequest(LedgerApi.RequestType.SIGN_TRANSACTION,
            async (api, params): Promise<Nimiq.Transaction> => {
                // Note: We make api calls outside of try...catch blocks to let the exceptions fall through such that
                // _callLedger can decide how to behave depending on the api error. All other errors are converted to
                // REQUEST_ASSERTION_FAILED errors which stop the execution of the request.
                const signerPubKeyBytes =
                    (await api.getPublicKey(params.keyPath, /*validate*/ true, /*display*/ false)).publicKey;

                let nimiqTx: Nimiq.Transaction;
                let signerPubKey: Nimiq.PublicKey;
                try {
                    const tx = params.transaction!;
                    signerPubKey = new Nimiq.PublicKey(signerPubKeyBytes);

                    const senderType = tx.senderType !== undefined && tx.senderType !== null
                        ? tx.senderType
                        : Nimiq.Account.Type.BASIC;

                    const recipientType = tx.recipientType !== undefined && tx.recipientType !== null
                        ? tx.recipientType
                        : Nimiq.Account.Type.BASIC;

                    let network = tx.network;
                    if (!network) {
                        try {
                            network = Nimiq.GenesisConfig.NETWORK_NAME as 'main' | 'test' | 'dev';
                        } catch (e) {
                            // Genesis config not initialized
                            network = 'main';
                        }
                    }

                    const genesisConfig = Nimiq.GenesisConfig.CONFIGS[network];
                    const networkId = genesisConfig.NETWORK_ID;

                    const flags = tx.flags !== undefined && tx.flags !== null
                        ? tx.flags
                        : Nimiq.Transaction.Flag.NONE;
                    const fee = tx.fee || 0;

                    if (tx.extraData && tx.extraData.length !== 0
                        || senderType !== Nimiq.Account.Type.BASIC
                        || recipientType !== Nimiq.Account.Type.BASIC
                        || flags !== Nimiq.Transaction.Flag.NONE
                    ) {
                        const extraData = tx.extraData ? tx.extraData : new Uint8Array(0);
                        nimiqTx = new Nimiq.ExtendedTransaction(tx.sender, senderType, tx.recipient,
                            recipientType, tx.value, fee, tx.validityStartHeight, flags, extraData,
                            /*proof*/ undefined, networkId);
                    } else {
                        nimiqTx = new Nimiq.BasicTransaction(signerPubKey, tx.recipient, tx.value,
                            fee, tx.validityStartHeight, /*signature*/ undefined, networkId);
                    }
                } catch (e) {
                    this._throwError(LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED, e, request);
                }

                const signatureBytes =
                    (await api.signTransaction(params.keyPath, nimiqTx!.serializeContent())).signature;

                try {
                    const signature = new Nimiq.Signature(signatureBytes);

                    if (nimiqTx! instanceof Nimiq.BasicTransaction) {
                        nimiqTx.signature = signature;
                    } else {
                        nimiqTx!.proof = Nimiq.SignatureProof.singleSig(signerPubKey!, signature).serialize();
                    }
                } catch (e) {
                    this._throwError(LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED, e, request);
                }

                return nimiqTx!;
            },
            {
                walletId,
                keyPath,
                transaction,
            },
        );

        if (!LedgerApi.BIP32_PATH_REGEX.test(keyPath)) {
            this._throwError(LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED, `Invalid keyPath ${keyPath}`, request);
        }
        return LedgerApi._callLedger(request);
    }

    // private fields and methods
    private static _apiPromise: Promise<LedgerJs> | null = null;
    private static _currentState: LedgerApi.State = { type: 'idle' as LedgerApi.StateType };
    private static _currentRequest: LedgerApiRequest<any> | null = null;
    private static _currentlyConnectedWalletId: string | null = null;
    private static _listeners = new Map<LedgerApi.EventType, LedgerApiListener[]>();

    private static async _callLedger<T>(request: LedgerApiRequest<T>): Promise<T> {
        if (LedgerApi.isBusy) {
            LedgerApi._throwError(LedgerApi.ErrorType.LEDGER_BUSY, 'Only one call to Ledger at a time allowed',
                request);
        }
        try {
            LedgerApi._currentRequest = request;
            return await new Promise<T>(async (resolve, reject) => {
                let isConnected = false;
                let wasLocked = false;
                request.on(LedgerApiRequest.EVENT_CANCEL, () => {
                    // If the ledger is not connected, we can reject the call right away. Otherwise just notify that
                    // the request was requested to be cancelled such that the user can cancel the call on the ledger.
                    LedgerApi._setState(LedgerApi.StateType.REQUEST_CANCELLING);
                    if (!isConnected) {
                        LedgerApi._fire(LedgerApi.EventType.REQUEST_CANCELLED, request);
                        reject(new Error('Request cancelled'));
                    }
                });
                while (!request.cancelled
                    || wasLocked) { // when locked continue even when cancelled to replace call, see notes
                    try {
                        const api = await LedgerApi._connect(request.params.walletId);
                        isConnected = true;
                        if (request.cancelled && !wasLocked) break; // don't break on wasLocked to replace the call
                        if (!request.cancelled) {
                            LedgerApi._setState(LedgerApi.StateType.REQUEST_PROCESSING);
                        }
                        const result = await request.call(api);
                        if (request.cancelled) break; // don't check wasLocked here as if cancelled should never resolve
                        LedgerApi._fire(LedgerApi.EventType.REQUEST_SUCCESSFUL, request, result);
                        resolve(result);
                        return;
                    } catch (e) {
                        console.log(e);
                        const message = (e.message || e || '').toLowerCase();
                        wasLocked = message.indexOf('locked') !== -1;
                        if (message.indexOf('timeout') !== -1) isConnected = false;
                        // user cancelled call on ledger
                        if (message.indexOf('denied') !== -1 // user rejected confirmAddress
                            || message.indexOf('rejected') !== -1) { // user rejected signTransaction
                            break; // continue after loop
                        }
                        // Errors that should end the request
                        if ((LedgerApi.currentState.error
                            && LedgerApi.currentState.error.type === LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED)
                            || message.indexOf('not supported') !== -1) { // no browser support
                            reject(e);
                            return;
                        }
                        // On other errors try again
                        if (message.indexOf('timeout') === -1 && message.indexOf('locked') === -1
                            && message.indexOf('busy') === -1 && message.indexOf('outdated') === -1
                            && message.indexOf('dependencies') === -1 && message.indexOf('wrong ledger') === -1) {
                            console.warn('Unknown Ledger Error', e);
                        }
                        // Wait a little when replacing a previous request (see notes at top).
                        const waitTime = message.indexOf('timeout') !== -1 ? LedgerApi.WAIT_TIME_AFTER_TIMEOUT
                            // If the API tells us that the ledger is busy (see notes at top) use a longer wait time to
                            // reduce the chance that we hit unfortunate 1.5s window after timeout of cancelled call
                            : message.indexOf('busy') !== -1 ? 4 * LedgerApi.WAIT_TIME_AFTER_TIMEOUT
                                // For other exceptions wait a little to avoid busy endless loop for some exceptions.
                                : LedgerApi.WAIT_TIME_AFTER_ERROR;
                        await new Promise((resolve2) => setTimeout(resolve2, waitTime));
                    }
                }
                LedgerApi._fire(LedgerApi.EventType.REQUEST_CANCELLED, request);
                reject(new Error('Request cancelled'));
            });
        } finally {
            LedgerApi._currentRequest = null;
            LedgerApi._currentlyConnectedWalletId = null; // reset as we don't note when Ledger gets disconnected
            const errorType = LedgerApi.currentState.error ? LedgerApi.currentState.error.type : null;
            if (errorType !== LedgerApi.ErrorType.NO_BROWSER_SUPPORT
                && errorType !== LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED) {
                LedgerApi._setState(LedgerApi.StateType.IDLE);
            }
        }
    }

    private static async _connect(walletId?: string): Promise<LedgerJs> {
        // Resolves when connected to unlocked ledger with open Nimiq app otherwise throws an exception after timeout.
        // If the Ledger is already connected and the library already loaded, the call typically takes < 500ms.
        try {
            const api = await LedgerApi._loadApi();
            LedgerApi._setState(LedgerApi.StateType.CONNECTING);
            // To check whether the connection to Nimiq app is established and to calculate the walletId. This can also
            // unfreeze the ledger app, see notes at top. Using getPublicKey and not getAppConfiguration, as other apps
            // also respond to getAppConfiguration. Set validate to false as otherwise the call is much slower.
            const { publicKey: firstAccountPubKeyBytes } =
                await api.getPublicKey(LedgerApi.getBip32PathForKeyId(0), /*validate*/ false, /*display*/ false);
            const version = (await api.getAppConfiguration()).version;
            if (!LedgerApi._isAppVersionSupported(version)) throw new Error('Ledger Nimiq App is outdated.');
            // Use sha256 as blake2b yields the nimiq address
            LedgerApi._currentlyConnectedWalletId = Nimiq.Hash.sha256(firstAccountPubKeyBytes).toBase64();
            if (walletId !== undefined && LedgerApi._currentlyConnectedWalletId !== walletId) {
                throw new Error('Wrong Ledger connected');
            }
            this._fire(LedgerApi.EventType.CONNECTED, LedgerApi._currentlyConnectedWalletId);
            return api;
        } catch (e) {
            const message = (e.message || e || '').toLowerCase();
            if (message.indexOf('wrong ledger') !== -1) {
                LedgerApi._throwError(LedgerApi.ErrorType.WRONG_LEDGER, e);
            }
            LedgerApi._currentlyConnectedWalletId = null;
            if (message.indexOf('browser support') !== -1 || message.indexOf('u2f device_ineligible') !== -1
                || message.indexOf('u2f other_error') !== -1) {
                LedgerApi._throwError(LedgerApi.ErrorType.NO_BROWSER_SUPPORT,
                    'Ledger not supported by browser or support not enabled.');
            } else if (message.indexOf('outdated') !== -1) {
                LedgerApi._throwError(LedgerApi.ErrorType.APP_OUTDATED, e);
            } else if (message.indexOf('busy') !== -1) {
                LedgerApi._throwError(LedgerApi.ErrorType.LEDGER_BUSY, e);
            } else if (message.indexOf('dependencies') !== -1) {
                LedgerApi._throwError(LedgerApi.ErrorType.FAILED_LOADING_DEPENDENCIES, e);
            }
            // on other errors (like timeout, dongle locked) that just keep the API retrying and not fire an error state
            // we just rethrow the error.
            throw e;
        }
    }

    private static async _loadApi(): Promise<LedgerJs> {
        // TODO: Lazy loading of Ledger Api
        LedgerApi._apiPromise = LedgerApi._apiPromise
            || (async () => {
                LedgerApi._setState(LedgerApi.StateType.LOADING);
                const transport = await LedgerJs.Transport.create();
                return new LedgerJs.Api(transport);
            })().catch((e: Error) => {
                LedgerApi._apiPromise = null;
                throw e;
            });
        const [api] = await Promise.all([
            LedgerApi._apiPromise,
            // needed for walletId hashing and address derivation from public key in SignatureProof and BasicTransaction
            Nimiq.WasmHelper.doImport(),
        ]).catch((e) => {
            throw new Error(`Failed loading dependencies: ${e.message || e}`);
        });
        return api;
    }

    private static _isAppVersionSupported(versionString: string): boolean {
        const version = versionString.split('.').map((part) => parseInt(part, 10));
        for (let i = 0; i < LedgerApi.MIN_REQUIRED_APP_VERSION.length; ++i) {
            if (typeof version[i] === 'undefined' || version[i] < LedgerApi.MIN_REQUIRED_APP_VERSION[i]) return false;
            if (version[i] > LedgerApi.MIN_REQUIRED_APP_VERSION[i]) return true;
        }
        return true;
    }

    private static _setState(state: LedgerApi.State | LedgerApi.StateType): void {
        if (typeof state === 'string') {
            // it's an entry from LedgerApi.StateType enum
            state = { type: state };
        }
        state.request = !state.request && LedgerApi._currentRequest ? LedgerApi._currentRequest : state.request;

        if (LedgerApi._currentState.type === state.type
            && (LedgerApi._currentState.error === state.error
                || (!!LedgerApi._currentState.error && !!state.error
                    && LedgerApi._currentState.error.type === state.error.type))
            && LedgerApi._currentState.request === state.request) return;
        LedgerApi._currentState = state;
        LedgerApi._fire(LedgerApi.EventType.STATE_CHANGE, state);
    }

    private static _throwError(type: LedgerApi.ErrorType,
                               error: Error | string, request?: LedgerApiRequest<any>): void {
        const state: LedgerApi.State = {
            type: LedgerApi.StateType.ERROR,
            error: {
                type,
                message: typeof error === 'string' ? error : error.message,
            },
        };
        if (request) state.request = request;
        LedgerApi._setState(state);
        if (typeof error === 'string') {
            throw new Error(error);
        } else {
            throw error;
        }
    }

    private static _fire(eventName: LedgerApi.EventType, ...args: any[]): void {
        const listenersForEvent = LedgerApi._listeners.get(eventName);
        if (!listenersForEvent) return;
        for (const listener of listenersForEvent) {
            setTimeout(listener, 0, ...args);
        }
    }

}

namespace LedgerApi { // tslint:disable-line:no-namespace
    // events appear at a single point of time while states reflect the current state of the api for a timespan ranging
    // into the future. E.g. if a request was cancelled, a REQUEST_CANCELLED event gets thrown and the state changes to
    // IDLE. Errors trigger an error state (e.g. when app outdated) and thus are a state, not an event.
    export const enum EventType {
        STATE_CHANGE = 'state-change',
        REQUEST_SUCCESSFUL = 'request-successful',
        REQUEST_CANCELLED = 'request-cancelled',
        CONNECTED = 'connected',
    }

    export const enum StateType {
        IDLE = 'idle',
        LOADING = 'loading',
        CONNECTING = 'connecting',
        REQUEST_PROCESSING = 'request-processing',
        REQUEST_CANCELLING = 'request-cancelling',
        ERROR = 'error',
    }

    export const enum RequestType {
        GET_WALLET_ID = 'get-wallet-id',
        DERIVE_ACCOUNTS = 'derive-accounts',
        GET_PUBLIC_KEY = 'get-public-key',
        GET_ADDRESS = 'get-address',
        CONFIRM_ADDRESS = 'confirm-address',
        SIGN_TRANSACTION = 'sign-transaction',
    }

    export const enum ErrorType {
        LEDGER_BUSY = 'ledger-busy',
        FAILED_LOADING_DEPENDENCIES = 'failed-loading-dependencies',
        NO_BROWSER_SUPPORT = 'no-browser-support',
        APP_OUTDATED = 'app-outdated',
        WRONG_LEDGER = 'wrong-ledger',
        REQUEST_ASSERTION_FAILED = 'request-specific-error',
    }

    export interface State {
        type: LedgerApi.StateType;
        error?: {
            type: LedgerApi.ErrorType;
            message: string;
        };
        request?: LedgerApiRequest<any>;
    }

    export interface RequestParams {
        walletId?: string; // optional for all calls
        keyPath?: string; // for everything besides DERIVE_ACCOUNTS
        pathsToDerive?: Iterable<string>; // for DERIVE_ACCOUNTS
        addressToConfirm?: string; // for CONFIRM_TRANSACTION
        transaction?: TransactionInfo; // for SIGN_TRANSACTION
    }
}

export default LedgerApi;
