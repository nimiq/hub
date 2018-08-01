import EncryptionType from '../types/EncryptionType';
import { TransactionRequest } from '../types/KeyguardRequest';
import RpcClient from './RpcClient';

class KeyguardClient {
    // FIXME Replace by real origin (or from config)
    private static KEYGUARD_ORIGIN = '*';

    private _keyguardSrc: string;

    private __iframeClient: any;

    private _connected: any;


    constructor(src = '../src') {
        this._keyguardSrc = src;

        this._connected = this._startIFrame();
    }

    /**
     * @param {boolean} [listFromAccountStore] Deprecated, list from old AccountStore
     * @returns {Promise<KeyInfo[] | AccountInfo[]>}
     */
    public async list(listFromAccountStore = false) {
        await this._connected;
        return this._iframeClient.call('list', [listFromAccountStore]);
    }

    /**
     * @returns {Promise<boolean>}
     * @deprecated Only for database migration
     */
    public async migrateDB() {
        await this._connected;
        return this._iframeClient.call('migrateAccountsToKeys');
    }

    public async create(type: EncryptionType, label: string) {
        return this._startPopup('create', [{
            type: type || EncryptionType.HIGH,
            label,
        }]);
    }

    public async importWords() {
        return this._startPopup('import-words');
    }

    public async importFile() {
        return this._startPopup('import-file');
    }

    /**
     * @param {string} address
     * @returns {Promise<void>}
     */
    public async export(address: string) {
        return this._startPopup('export-words', [address]);
    }

    /**
     * @param {TransactionRequest} txRequest
     * @returns {Promise<SignedTransactionResult>}
     */
    public async signTransaction(txRequest: TransactionRequest) {
        return this._startPopup('sign-transaction', [txRequest]);
    }

    /**
     * @param {string | Uint8Array} message - A utf-8 string or byte array of max 255 bytes
     * @param {string} signer - The address of the signer
     * @returns {Promise<SignedMessageResult>}
     */
    public async signMessage(message: string | Uint8Array, signer: string) {
        /** @type {MessageRequest} */
        const msgRequest = {
            message,
            signer,
        };
        return this._startPopup('sign-message', [msgRequest]);
    }

    /**
     * @param {string} address
     * @returns {Promise<void>}
     */
    public async changeEncryption(address: string) {
        return this._startPopup('change-encryption', [address]);
    }

    /**
     * @param {string} address
     * @returns {Promise<void>}
     */
    public async delete(address: string) {
        return this._startPopup('delete', [address]);
    }

    /* PRIVATE METHODS */

    private async _startIFrame() {
        const $iframe = await this._createIframe();

        if (!$iframe.contentWindow) {
            throw new Error(`IFrame contentWindow is ${typeof $iframe.contentWindow}`);
        }

        this.__iframeClient = await RpcClient.create($iframe.contentWindow, KeyguardClient.KEYGUARD_ORIGIN);
    }

    private async _createIframe() {
        return new Promise((resolve, reject) => {
            const $iframe = document.createElement('iframe');
            resolve($iframe);
            $iframe.name = 'Nimiq Keyguard IFrame';
            $iframe.style.display = 'none';
            document.body.appendChild($iframe);
            $iframe.src = `${this._keyguardSrc}/request/iframe/`;
            $iframe.onload = () => resolve($iframe);
            $iframe.onerror = reject;
        }) as Promise<HTMLIFrameElement>;
    }

    /**
     * @param {string} requestName - The request name in kebab-case (folder name)
     * @param {any[]} [args]
     */
    private async _startPopup(requestName: string, args?: any[]) {
        const requestUrl = `${this._keyguardSrc}/request/${requestName}/`;

        const $popup = window.open(
            requestUrl,
            'NimiqPopup',
            `left=${window.innerWidth / 2 - 250},top=100,width=500,height=820,location=yes,dependent=yes`,
        );

        if (!$popup) {
            throw new Error('Nimiq popup could not be opened.');
        }

        // Await popup loaded
        await new Promise((res) => { $popup.onload = res; });

        // FIXME improve typing
        const rpcClient = await RpcClient.create($popup, KeyguardClient.KEYGUARD_ORIGIN) as any;

        try {
            const result = await rpcClient.call('request', args);
            rpcClient.close();
            $popup.close();
            return result;
        } catch (e) {
            rpcClient.close();
            $popup.close();
            throw e;
        }
    }

    private get _iframeClient() {
        if (!this.__iframeClient) {
          throw new Error('IFrame not available');
        }

        return this.__iframeClient;
    }
}
