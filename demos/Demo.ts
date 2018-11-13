/// <reference path="../node_modules/@nimiq/core-types/Nimiq.d.ts" />

import * as Rpc from '@nimiq/rpc';
import AccountsClient from '../client/AccountsClient';
import {
    RequestType,
    SignupRequest, SignupResult,
    CheckoutRequest,
    LoginRequest, LoginResult,
    LogoutRequest, LogoutResult,
    SignTransactionRequest, SignTransactionResult,
    ExportWordsRequest, ExportWordsResult,
    ExportFileRequest, ExportFileResult, AddAccountRequest,
} from '../src/lib/RequestTypes';
import { WalletStore } from '../src/lib/WalletStore';
import { WalletInfoEntry } from '../src/lib/WalletInfo';
import { RedirectRequestBehavior } from '../client/RequestBehavior';

class Demo {
    public static run() {
        (async () => {
            await Nimiq.WasmHelper.doImportBrowser();
            Nimiq.GenesisConfig.test();
            document.querySelectorAll('button').forEach(button => button.disabled = false);
            (document.querySelector('button#list-accounts') as HTMLButtonElement).click();
        })();

        const demo = new Demo('http://localhost:8000');

        const client = new AccountsClient('http://localhost:8080');
        client.on(RequestType.CHECKOUT, (result: SignTransactionResult, state: Rpc.State) => {
            console.log('AccountsManager result', result);
            console.log('State', state);

            document.querySelector('#result').textContent = 'TX signed';
        }, (error: Error, state: Rpc.State) => {
            console.error('AccountsManager error', error);
            console.log('State', state);

            document.querySelector('#result').textContent = `Error: ${error.message || error}`;
        });
        client.on(RequestType.SIGNUP, (result: SignupResult, state: Rpc.State) => {
            console.log('AccountsManager result', result);
            console.log('State', state);

            document.querySelector('#result').textContent = 'SignUp completed';
        }, (error: Error, state: Rpc.State) => {
            console.error('AccountsManager error', error);
            console.log('State', state);

            document.querySelector('#result').textContent = `Error: ${error.message || error}`;
        });
        client.checkRedirectResponse();

        document.querySelector('button#checkout-redirect').addEventListener('click', async () => {
            checkoutRedirect(await generateCheckoutRequest(demo));
        });

        document.querySelector('button#checkout-popup').addEventListener('click', async () => {
            await checkoutPopup(await generateCheckoutRequest(demo));
        });

        document.querySelector('button#sign-transaction-popup').addEventListener('click', async () => {
            const txRequest = generateSignTransactionRequest(demo);
            try {
                const result = await client.signTransaction(txRequest);
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'TX signed';
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#create').addEventListener('click', async () => {
            try {
                const result = await client.signup(generateCreateRequest(demo));
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'New wallet & account created';
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }
        });

        function generateCreateRequest(demo: Demo): SignupRequest {
            return {
                appName: 'Accounts Demos',
            }
        }

        document.querySelector('button#login').addEventListener('click', async () => {
            try {
                const result = await client.login(generateLoginRequest(demo));
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'Wallet imported';
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }
        });

        function generateLoginRequest(demo: Demo): LoginRequest {
            return {
                appName: 'Accounts Demos',
            }
        }

        function generateSignTransactionRequest(demo: Demo): SignTransactionRequest {
            const $radio = document.querySelector('input[type="radio"]:checked');
            if (!$radio) {
                alert('You have no account to send a tx from, create an account first (signup)');
                throw new Error('No account found');
            }
            const sender = $radio.getAttribute('data-address');
            const walletId = $radio.getAttribute('data-wallet-id');
            const value = parseInt((document.querySelector('#value') as HTMLInputElement).value) || 1337;
            const fee = parseInt((document.querySelector('#fee') as HTMLInputElement).value) || 0;
            const txData = (document.querySelector('#data') as HTMLInputElement).value || '';
            const validityStartHeight = (document.querySelector('#validitystartheight') as HTMLInputElement).value || '1234';

            return {
                appName: 'Accounts Demos',
                walletId,
                sender,
                recipient: 'NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU',
                value,
                fee,
                extraData: Nimiq.BufferUtils.fromAscii(txData),
                validityStartHeight: parseInt(validityStartHeight),
            };
        }

        async function generateCheckoutRequest(demo: Demo): Promise<CheckoutRequest> {
            const value = parseInt((document.querySelector('#value') as HTMLInputElement).value) || 1337;
            const txFee = parseInt((document.querySelector('#fee') as HTMLInputElement).value) || 0;
            const txData = (document.querySelector('#data') as HTMLInputElement).value || '';

            return {
                appName: 'Accounts Demos',
                recipient: 'NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU',
                value,
                fee: txFee,
                extraData: Nimiq.BufferUtils.fromAscii(txData)
            };
        }

        function checkoutRedirect(txRequest: CheckoutRequest) {
            return client.checkout(txRequest, new RedirectRequestBehavior(null, { storedGreeting: 'Hello Nimiq!' }));
        }

        async function checkoutPopup(txRequest: CheckoutRequest) {
            try {
                const result = await client.checkout(txRequest);
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'TX signed';
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }
        }

        document.querySelector('button#list-keyguard-keys').addEventListener('click', () => demo.listKeyguard());
        document.querySelector('button#list-accounts').addEventListener('click', async () => demo.updateAccounts());
        demo._accountsClient = client;
    } // run

    private static async _createIframe(baseUrl): Promise<HTMLIFrameElement> {
        return new Promise<HTMLIFrameElement>((resolve, reject) => {
            const $iframe = document.createElement('iframe');
            $iframe.name = 'Nimiq Keyguard Setup IFrame';
            $iframe.style.display = 'none';
            document.body.appendChild($iframe);
            $iframe.src = `${baseUrl}/demos/setup.html`;
            $iframe.onload = () => resolve($iframe);
            $iframe.onerror = reject;
        });
    }

    private _iframeClient: Rpc.PostMessageRpcClient | null;
    private _keyguardBaseUrl: string;
    private _accountsClient: AccountsClient;

    constructor(keyguardBaseUrl: string) {
        this._iframeClient = null;
        this._keyguardBaseUrl = keyguardBaseUrl;
    }

    public async startIframeClient(baseUrl: string): Promise<Rpc.PostMessageRpcClient> {
        if (this._iframeClient) return this._iframeClient;
        const $iframe = await Demo._createIframe(baseUrl);
        if (!$iframe.contentWindow) throw new Error(`IFrame contentWindow is ${typeof $iframe.contentWindow}`);
        this._iframeClient = new Rpc.PostMessageRpcClient($iframe.contentWindow, '*');
        await this._iframeClient.init();
        return this._iframeClient;
    }

    public async listKeyguard() {
        const client = await this.startIframeClient(this._keyguardBaseUrl);
        const keys = await client.call('list');
        console.log('Keys in Keyguard:', keys);
        return keys;
    }

    public async list(): Promise<WalletInfoEntry[]> {
        return await WalletStore.Instance.list();
    }

    public async logout(walletId: string): Promise<LogoutResult> {
        try {
            const result = await this._accountsClient.logout(this._createLogoutRequest(keyId));
            console.log('Keyguard result', result);
            document.querySelector('#result').textContent = 'Wallet Removed';
            return result;
        } catch (e) {
            console.error('Keyguard error', e);
            document.querySelector('#result').textContent = `Error: ${e.message || e}`;
        }
    }

    public _createLogoutRequest(walletId: string): LogoutRequest {
        return {
            appName: 'Accounts Demos',
            walletId,
        } as LogoutRequest;
    }

    public async exportWords(walletId: string) {
        try {
            const result = await this._accountsClient.exportWords(this._createExportWordsRequest(keyId));
            console.log('Keyguard result', result);
            document.querySelector('#result').textContent = 'Words exported';
        } catch (e) {
            console.error('Keyguard error', e);
            document.querySelector('#result').textContent = `Error: ${e.message || e}`;
        }
    }

    public _createExportWordsRequest(walletId: string): ExportWordsRequest {
        return {
            appName: 'Accounts Demos',
            walletId,
        } as ExportWordsRequest;
    }

    public async exportFile(walletId: string) {
        try {
            const result = await this._accountsClient.exportFile(this._createExportFileRequest(keyId));
            console.log('Keyguard result', result);
            document.querySelector('#result').textContent = 'File exported';
        } catch (e) {
            console.error('Keyguard error', e);
            document.querySelector('#result').textContent = `Error: ${e.message || e}`;
        }
    }

    public _createExportFileRequest(walletId: string): ExportFileRequest {
        return {
            appName: 'Accounts Demos',
            walletId,
        } as ExportFileRequest;
    }

    public async addAccount(keyId: string) {
        try {
            const result = await this._accountsClient.addAccount(this._createAddAccountRequest(keyId));
            console.log('Keyguard result', result);
            document.querySelector('#result').textContent = 'Account added';
        } catch (e) {
            console.error('Keyguard error', e);
            document.querySelector('#result').textContent = `Error: ${e.message || e}`;
        }
    }

    public _createAddAccountRequest(walletId: string): AddAccountRequest {
        return {
            appName: 'Accounts Demos',
            walletId,
        };
    }

    public async updateAccounts() {
        const wallets = await this.list();
        console.log('Accounts in Manager:', wallets);

        const $ul = document.querySelector('#accounts');
        let html = '';

        wallets.forEach(wallet => {
            html += `<li>${wallet.label}
                        <button class="export-words" data-wallet-id="${wallet.id}">Words</button>
                        <button class="export-file" data-wallet-id="${wallet.id}">File</button>
                        ${wallet.type !== 0 ? `<button class="add-account" data-wallet-id="${wallet.id}">+ Acc</button>` : ''}
                        <button class="logout" data-wallet-id="${wallet.id}">Logout</button>
                        <ul>`;
            wallet.accounts.forEach((acc, addr) => {
                html += `
                            <li>
                                <label>
                                    <input type="radio" name="sign-tx-address" data-address="${addr}" data-wallet-id="${wallet.id}">
                                    ${acc.label}
                                </label>
                            </li>
                `;
            });
            html += '</ul></li>';
        });

        $ul.innerHTML = html;
        if (document.querySelector('input[type="radio"]')) {
            (document.querySelector('input[type="radio"]') as HTMLInputElement).checked = true;
        }
        document.querySelectorAll('button.export-words').forEach(element => {
            element.addEventListener('click', async () => this.exportWords(element.getAttribute('data-wallet-id')));
        });
        document.querySelectorAll('button.export-file').forEach(element => {
            element.addEventListener('click', async () => this.exportFile(element.getAttribute('data-wallet-id')));
        });
        document.querySelectorAll('button.add-account').forEach( (element, key) => {
            element.addEventListener('click', async () => this.addAccount(element.getAttribute('data-wallet-id')));
        });
        document.querySelectorAll('button.logout').forEach( (element,key) =>{
            element.addEventListener('click', async () => this.logout(element.getAttribute('data-wallet-id')));
        });
    }
} // class Demo

Demo.run();
