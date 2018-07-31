/* global EncryptionType */
/* global RpcClient */

class KeyguardClient {
    constructor(src = '../src') {
        this._keyguardSrc = src;

        this._connected = this._startIFrame();
    }

    /**
     * @param {boolean} [listFromAccountStore] Deprecated, list from old AccountStore
     * @returns {Promise<KeyInfo[] | AccountInfo[]>}
     */
    async list(listFromAccountStore) {
        await this._connected;
        return this.iframeClient.call('list', [listFromAccountStore]);
    }

    /**
     * @returns {Promise<boolean>}
     * @deprecated Only for database migration
     */
    async migrateDB() {
        await this._connected;
        return this.iframeClient.call('migrateAccountsToKeys');
    }

    /**
     * @param {EncryptionType} [type]
     * @param {string} [label]
     * @returns {Promise<void>}
     */
    async create(type, label) {
        return this._startPopup('create', [{
            type: type || EncryptionType.HIGH,
            label,
        }]);
    }

    /**
     * @returns {Promise<void>}
     */
    async importWords() {
        return this._startPopup('import-words');
    }

    /**
     * @returns {Promise<void>}
     */
    async importFile() {
        return this._startPopup('import-file');
    }

    /**
     * @param {string} address
     * @returns {Promise<void>}
     */
    async export(address) {
        return this._startPopup('export-words', [address]);
    }

    /**
     * @param {TransactionRequest} txRequest
     * @returns {Promise<SignedTransactionResult>}
     */
    async signTransaction(txRequest) {
        return this._startPopup('sign-transaction', [txRequest]);
    }

    /**
     * @param {string | Uint8Array} message - A utf-8 string or byte array of max 255 bytes
     * @param {string} signer - The address of the signer
     * @returns {Promise<SignedMessageResult>}
     */
    async signMessage(message, signer) {
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
    async changeEncryption(address) {
        return this._startPopup('change-encryption', [address]);
    }

    /**
     * @param {string} address
     * @returns {Promise<void>}
     */
    async delete(address) {
        return this._startPopup('delete', [address]);
    }

    /* PRIVATE METHODS */

    /**
     * @returns {Promise<void>}
     */
    async _startIFrame() {
        const $iframe = await this._createIframe();
        if (!$iframe.contentWindow) throw new Error(`IFrame contentWindow is ${typeof $iframe.contentWindow}`);
        this._iframeClient = await RpcClient.create($iframe.contentWindow, KeyguardClient.KEYGUARD_ORIGIN);
    }

    /**
     * @returns {Promise<HTMLIFrameElement>}
     */
    async _createIframe() {
        return new Promise((resolve, reject) => {
            const $iframe = document.createElement('iframe');
            $iframe.name = 'Nimiq Keyguard IFrame';
            $iframe.style.display = 'none';
            document.body.appendChild($iframe);
            $iframe.src = `${this._keyguardSrc}/request/iframe/`;
            $iframe.onload = () => resolve($iframe);
            $iframe.onerror = reject;
        });
    }

    /**
     * @param {string} requestName - The request name in kebab-case (folder name)
     * @param {any[]} [args]
     */
    async _startPopup(requestName, args) {
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
        await new Promise(res => { $popup.onload = res; });

        const rpcClient = await RpcClient.create($popup, KeyguardClient.KEYGUARD_ORIGIN);

        // FIXME Remove after debugging
        this.popup = rpcClient;

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

    /** @type {RpcClientInstance} */
    get iframeClient() {
        if (!this._iframeClient) throw new Error('IFrame not available');
        return this._iframeClient;
    }
}

// FIXME Replace by real origin (or from config)
KeyguardClient.KEYGUARD_ORIGIN = '*';
