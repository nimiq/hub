class PopupClient {
    /**
     * @param {EncryptionType} [type]
     * @param {string} [label]
     * @returns {Promise<void>}
     */
    async create(address) {
        return this._startPopup('create', [{
            address
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
    async delete(address) {
        return this._startPopup('delete', [address]);
    }

    /* PRIVATE METHODS */


    /**
     * @param {string} requestName - The request name in kebab-case (folder name)
     * @param {any[]} [args]
     */
    async _startPopup(requestName, args) {
        const requestUrl = `${PopupClient.SRC}#request/${requestName}/`;

        const $popup = window.open(
            requestUrl,
            'NimiqPopup',
            `left=${window.innerWidth / 2 - 250},top=100,width=500,height=820,location=yes,dependent=yes`,
        );

        if (!$popup) {
            throw new Error('Nimiq Popup could not be opened.');
        }

        // Await popup loaded
        await new Promise(res => {
            $popup.onload = res;
        });

        const rpcClient = await RpcClient.create($popup, self.origin);

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
}

// TODO make this configurable
PopupClient.SRC = 'http://localhost/apps/accounts/src/popup.html';

