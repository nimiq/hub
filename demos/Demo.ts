/// <reference path="../node_modules/@nimiq/core-types/Nimiq.d.ts" />

import { State, PostMessageRpcClient } from '@nimiq/rpc';
import AccountsClient from '../client/AccountsClient';
import { RequestType } from '../src/lib/RequestTypes';
import {
    SimpleRequest,
    Account,
    CheckoutRequest,
    SimpleResult,
    SignTransactionRequest, SignedTransaction,
    RenameRequest,
    SignMessageRequest,
} from '../src/lib/PublicRequestTypes';
import { RedirectRequestBehavior } from '../client/RequestBehavior';
import { Utf8Tools } from '@nimiq/utils';

class Demo {
    public static run() {
        const keyguardOrigin = location.origin === 'https://accounts.nimiq-testnet.com'
            ? 'https://keyguard.nimiq-testnet.com'
            : `${location.protocol}//${location.hostname}:8000`;
        const demo = new Demo(keyguardOrigin);

        const client = new AccountsClient(location.origin);

        client.on(RequestType.CHECKOUT, (result: SignedTransaction, state: State) => {
            console.log('AccountsManager result', result);
            console.log('State', state);

            document.querySelector('#result').textContent = 'TX signed';
        }, (error: Error, state: State) => {
            console.error('AccountsManager error', error);
            console.log('State', state);

            document.querySelector('#result').textContent = `Error: ${error.message || error}`;
        });
        client.on(RequestType.SIGNUP, (result: Account, state: State) => {
            console.log('AccountsManager result', result);
            console.log('State', state);

            document.querySelector('#result').textContent = 'SignUp completed';
        }, (error: Error, state: State) => {
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

        document.querySelector('button#choose-address').addEventListener('click', async () => {
            try {
                const result = await client.chooseAddress({ appName: 'Accounts Demos' });
                console.log('Result', result);
                document.querySelector('#result').textContent = 'Address was chosen';
            } catch (e) {
                console.error('Result error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }
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

        document.querySelector('button#onboard').addEventListener('click', async () => {
            try {
                const result = await client.onboard({ appName: 'Accounts Demos' });
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'Onboarding completed!';
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#create').addEventListener('click', async () => {
            try {
                const result = await client.signup({ appName: 'Accounts Demos' });
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'New account & address created';
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#login').addEventListener('click', async () => {
            try {
                const result = await client.login({ appName: 'Accounts Demos' });
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'Account imported';
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }
        });

        function generateSignTransactionRequest(demo: Demo): SignTransactionRequest {
            const $radio = document.querySelector('input[type="radio"]:checked');
            if (!$radio) {
                alert('You have no account to send a tx from, create an account first (signup)');
                throw new Error('No account found');
            }
            const sender = $radio.getAttribute('data-address');
            const accountId = $radio.getAttribute('data-wallet-id');
            const value = parseInt((document.querySelector('#value') as HTMLInputElement).value) || 1337;
            const fee = parseInt((document.querySelector('#fee') as HTMLInputElement).value) || 0;
            const txData = (document.querySelector('#data') as HTMLInputElement).value || '';
            const validityStartHeight = (document.querySelector('#validitystartheight') as HTMLInputElement).value || '1234';

            return {
                appName: 'Accounts Demos',
                accountId,
                sender,
                recipient: 'NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU',
                value,
                fee,
                extraData: Utf8Tools.stringToUtf8ByteArray(txData),
                validityStartHeight: parseInt(validityStartHeight),
            };
        }

        async function generateCheckoutRequest(demo: Demo): Promise<CheckoutRequest> {
            const value = parseInt((document.querySelector('#value') as HTMLInputElement).value) || 1337;
            const txFee = parseInt((document.querySelector('#fee') as HTMLInputElement).value) || 0;
            const txData = (document.querySelector('#data') as HTMLInputElement).value || '';

            return {
                appName: 'Accounts Demos',
                shopLogoUrl: `${location.origin}/nimiq.png`,
                recipient: 'NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU',
                value,
                fee: txFee,
                extraData: Utf8Tools.stringToUtf8ByteArray(txData)
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

        document.querySelector('button#sign-message').addEventListener('click', async () => {
            const request = await generateSignMessageRequest(demo);
            try {
                const result = await client.signMessage(request);
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'MSG signed: ' + result.message;
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }
        });

        async function generateSignMessageRequest(demo: Demo): Promise<SignMessageRequest> {
            const message = (document.querySelector('#message') as HTMLInputElement).value || undefined;

            return {
                appName: 'Accounts Demos',
                // signer: 'NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU',
                message,
            };
        }

        document.querySelector('button#sign-message-with-account').addEventListener('click', async () => {
            const request = await generateSignMessageWithAccountRequest(demo);
            try {
                const result = await client.signMessage(request);
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'MSG signed: ' + result.message;
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }
        });

        async function generateSignMessageWithAccountRequest(demo: Demo): Promise<SignMessageRequest> {
            const message = (document.querySelector('#message') as HTMLInputElement).value || undefined;

            const $radio = document.querySelector('input[type="radio"]:checked');
            if (!$radio) {
                alert('You have no account to send a tx from, create an account first (signup)');
                throw new Error('No account found');
            }
            const signer = $radio.getAttribute('data-address');
            const accountId = $radio.getAttribute('data-wallet-id');

            return {
                appName: 'Accounts Demos',
                accountId,
                signer,
                message,
            };
        }

        document.querySelector('button#migrate').addEventListener('click', async () => {
            try {
                const result = await client.migrate();
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'Migrated';
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#list-keyguard-keys').addEventListener('click', () => demo.listKeyguard());
        document.querySelector('button#setup-legacy-accounts').addEventListener('click', () => demo.setupLegacyAccounts());
        document.querySelector('button#list-accounts').addEventListener('click', async () => demo.updateAccounts());
        demo._accountsClient = client;

        document.querySelectorAll('button').forEach(button => button.disabled = false);
        (document.querySelector('button#list-accounts') as HTMLButtonElement).click();
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

    private _iframeClient: PostMessageRpcClient | null;
    private _keyguardBaseUrl: string;
    private _accountsClient: AccountsClient;

    constructor(keyguardBaseUrl: string) {
        this._iframeClient = null;
        this._keyguardBaseUrl = keyguardBaseUrl;
    }

    public async startIframeClient(baseUrl: string): Promise<PostMessageRpcClient> {
        if (this._iframeClient) return this._iframeClient;
        const $iframe = await Demo._createIframe(baseUrl);
        if (!$iframe.contentWindow) throw new Error(`IFrame contentWindow is ${typeof $iframe.contentWindow}`);
        this._iframeClient = new PostMessageRpcClient($iframe.contentWindow, '*');
        await this._iframeClient.init();
        return this._iframeClient;
    }

    public async startPopupClient(url: string, windowName: string): Promise<PostMessageRpcClient> {
        const $popup = window.open(url, windowName);
        const popupClient = new PostMessageRpcClient($popup, '*');
        await popupClient.init();
        return popupClient;
    }

    public async listKeyguard() {
        const client = await this.startIframeClient(this._keyguardBaseUrl);
        const keys = await client.call('list');
        console.log('Keys in Keyguard:', keys);
        document.querySelector('#result').textContent = 'Keys listed in console';
        return keys;
    }

    public async setupLegacyAccounts() {
        const client = await this.startPopupClient(`${this._keyguardBaseUrl}/demos/setup.html`, 'Nimiq Keyguard Setup Popup');
        const result = await client.call('setUpLegacyAccounts');
        client.close();
        // @ts-ignore Property '_target' is private and only accessible within class 'PostMessageRpcClient'.
        client._target.close();
        console.log('Legacy Account setup:', result);
        document.querySelector('#result').textContent = 'Legacy Account stored';
    }

    public async list(): Promise<Account[]> {
        return await this._accountsClient.list();
    }

    public async logout(accountId: string): Promise<SimpleResult> {
        try {
            const result = await this._accountsClient.logout(this._createLogoutRequest(accountId));
            console.log('Keyguard result', result);
            document.querySelector('#result').textContent = 'Account removed';
            return result;
        } catch (e) {
            console.error('Keyguard error', e);
            document.querySelector('#result').textContent = `Error: ${e.message || e}`;
        }
    }

    public _createLogoutRequest(accountId: string): SimpleRequest {
        return {
            appName: 'Accounts Demos',
            accountId,
        } as SimpleRequest;
    }

    public async export(accountId: string) {
        try {
            const result = await this._accountsClient.export(this._createExportRequest(accountId));
            console.log('Keyguard result', result);
            document.querySelector('#result').textContent = 'Export sucessful';
        } catch (e) {
            console.error('Keyguard error', e);
            document.querySelector('#result').textContent = `Error: ${e.message || e}`;
        }
    }

    public _createExportRequest(accountId: string): SimpleRequest {
        return {
            appName: 'Accounts Demos',
            accountId,
        } as SimpleRequest;
    }

    public async changePassword(accountId: string) {
        try {
            const result = await this._accountsClient.changePassword(this._createChangePasswordRequest(accountId));
            console.log('Keyguard result', result);
            document.querySelector('#result').textContent = 'Export sucessful';
        } catch (e) {
            console.error('Keyguard error', e);
            document.querySelector('#result').textContent = `Error: ${e.message || e}`;
        }
    }

    public _createChangePasswordRequest(accountId: string): SimpleRequest {
        return {
            appName: 'Accounts Demos',
            accountId,
        } as SimpleRequest;
    }

    public async addAccount(accountId: string) {
        try {
            const result = await this._accountsClient.addAddress(this._createAddAccountRequest(accountId));
            console.log('Keyguard result', result);
            document.querySelector('#result').textContent = 'Account added';
        } catch (e) {
            console.error('Keyguard error', e);
            document.querySelector('#result').textContent = `Error: ${e.message || e}`;
        }
    }

    public _createAddAccountRequest(accountId: string): SimpleRequest {
        return {
            appName: 'Accounts Demos',
            accountId,
        } as SimpleRequest;
    }

    public async rename(accountId: string, account: string) {
        try {
            const result = await this._accountsClient.rename(this._createRenameRequest(accountId, account));
            console.log('Keyguard result', result);
            document.querySelector('#result').textContent = 'Done renaming account';
        } catch (e) {
            console.error('Keyguard error', e);
            document.querySelector('#result').textContent = `Error: ${e.message || e}`;
        }
    }

    public _createRenameRequest(accountId: string, address: string ): RenameRequest {
        return {
            appName: 'Accounts Demos',
            accountId,
            address,
        };
    }

    public async updateAccounts() {
        const wallets = await this.list();
        console.log('Accounts in Manager:', wallets);

        const $ul = document.querySelector('#accounts');
        let html = '';

        wallets.forEach(wallet => {
            html += `<li>${wallet.label}<br>
                        <button class="export" data-wallet-id="${wallet.accountId}">Export</button>
                        <button class="change-password" data-wallet-id="${wallet.accountId}">Ch. Pass.</button>
                        ${wallet.type !== 0 ? `<button class="add-account" data-wallet-id="${wallet.accountId}">+ Acc</button>` : ''}
                        <button class="rename" data-wallet-id="${wallet.accountId}">Rename</button>
                        <button class="logout" data-wallet-id="${wallet.accountId}">Logout</button>
                        <ul>`;
            wallet.addresses.forEach((acc) => {
                html += `
                            <li>
                                <label>
                                    <input type="radio" name="sign-tx-address" data-address="${acc.address}" data-wallet-id="${wallet.accountId}">
                                    ${acc.label}
                                    <button class="rename" data-wallet-id="${wallet.accountId}" data-address="${acc.address}">Rename</button>
                                </label>
                            </li>
                `;
            });
            wallet.contracts.forEach((con) => {
                html += `
                            <li>
                                <label>
                                    <input type="radio" name="sign-tx-address" data-address="${con.address}" data-wallet-id="${wallet.accountId}">
                                    <strong>Contract</strong> ${con.label}
                                    <button class="rename" data-wallet-id="${wallet.accountId}" data-address="${con.address}">Rename</button>
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
        document.querySelectorAll('button.export').forEach(element => {
            element.addEventListener('click', async () => this.export(element.getAttribute('data-wallet-id')));
        });
        document.querySelectorAll('button.change-password').forEach(element => {
            element.addEventListener('click', async () => this.changePassword(element.getAttribute('data-wallet-id')));
        });
        document.querySelectorAll('button.rename').forEach(element => {
            element.addEventListener('click', async () => this.rename(element.getAttribute('data-wallet-id'), element.getAttribute('data-address')));
        });
        document.querySelectorAll('button.add-account').forEach(element => {
            element.addEventListener('click', async () => this.addAccount(element.getAttribute('data-wallet-id')));
        });
        document.querySelectorAll('button.logout').forEach(element => {
            element.addEventListener('click', async () => this.logout(element.getAttribute('data-wallet-id')));
        });
    }
} // class Demo

Demo.run();
