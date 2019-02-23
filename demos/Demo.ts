/// <reference path="../node_modules/@nimiq/core-types/Nimiq.d.ts" />

import { State, PostMessageRpcClient } from '@nimiq/rpc';
import AccountsClient from '../client/AccountsClient';
import {
    RequestType,
    SimpleRequest,
    OnboardingResult,
    CheckoutRequest,
    LogoutRequest, LogoutResult,
    SignTransactionRequest, SignTransactionResult,
    ExportRequest,
    RenameRequest,
    ChangePasswordRequest,
    AddAccountRequest,
    SignMessageRequest,
} from '../src/lib/RequestTypes';
import { WalletInfoEntry } from '../src/lib/WalletInfo';
import { RedirectRequestBehavior } from '../client/RequestBehavior';
import { Utf8Tools } from '@nimiq/utils';

class Demo {
    public static run() {
        const demo = new Demo(`${location.protocol}//${location.hostname}:8000`);

        const client = new AccountsClient(location.origin);

        client.on(RequestType.CHECKOUT, (result: SignTransactionResult, state: State) => {
            console.log('AccountsManager result', result);
            console.log('State', state);

            document.querySelector('#result').textContent = 'TX signed';
        }, (error: Error, state: State) => {
            console.error('AccountsManager error', error);
            console.log('State', state);

            document.querySelector('#result').textContent = `Error: ${error.message || error}`;
        });
        client.on(RequestType.SIGNUP, (result: OnboardingResult, state: State) => {
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
                document.querySelector('#result').textContent = 'New wallet & account created';
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#login').addEventListener('click', async () => {
            try {
                const result = await client.login({ appName: 'Accounts Demos' });
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'Wallet imported';
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
                shopLogoUrl: 'http://localhost:8080/nimiq.png',
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
                document.querySelector('#result').textContent = 'MSG signed: ' + Utf8Tools.utf8ByteArrayToString(result.data);
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
                document.querySelector('#result').textContent = 'MSG signed: ' + Utf8Tools.utf8ByteArrayToString(result.data);
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
            const walletId = $radio.getAttribute('data-wallet-id');

            return {
                appName: 'Accounts Demos',
                walletId,
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

    public async listKeyguard() {
        const client = await this.startIframeClient(this._keyguardBaseUrl);
        const keys = await client.call('list');
        console.log('Keys in Keyguard:', keys);
        return keys;
    }

    public async setupLegacyAccounts() {
        const client = await this.startIframeClient(this._keyguardBaseUrl);
        const result = await client.call('setUpLegacyAccounts');
        console.log('Legacy Account setup:', result);
    }

    public async list(): Promise<WalletInfoEntry[]> {
        return await this._accountsClient.list();
    }

    public async logout(walletId: string): Promise<LogoutResult> {
        try {
            const result = await this._accountsClient.logout(this._createLogoutRequest(walletId));
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

    public async export(walletId: string) {
        try {
            const result = await this._accountsClient.export(this._createExportRequest(walletId));
            console.log('Keyguard result', result);
            document.querySelector('#result').textContent = 'Export sucessful';
        } catch (e) {
            console.error('Keyguard error', e);
            document.querySelector('#result').textContent = `Error: ${e.message || e}`;
        }
    }

    public _createExportRequest(walletId: string): ExportRequest {
        return {
            appName: 'Accounts Demos',
            walletId,
        } as ExportRequest;
    }

    public async changePassphrase(walletId: string) {
        try {
            const result = await this._accountsClient.changePassword(this._createChangePasswordRequest(walletId));
            console.log('Keyguard result', result);
            document.querySelector('#result').textContent = 'Export sucessful';
        } catch (e) {
            console.error('Keyguard error', e);
            document.querySelector('#result').textContent = `Error: ${e.message || e}`;
        }
    }

    public _createChangePasswordRequest(walletId: string): ChangePasswordRequest {
        return {
            appName: 'Accounts Demos',
            walletId,
        } as ChangePasswordRequest;
    }

    public async addAccount(walletId: string) {
        try {
            const result = await this._accountsClient.addAccount(this._createAddAccountRequest(walletId));
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



    public async rename(walletId: string, account: string) {
        try {
            const result = await this._accountsClient.rename(this._createRenameRequest(walletId, account));
            console.log('Keyguard result', result);
            document.querySelector('#result').textContent = 'Done renaming wallet';
        } catch (e) {
            console.error('Keyguard error', e);
            document.querySelector('#result').textContent = `Error: ${e.message || e}`;
        }
    }

    public _createRenameRequest(walletId: string, address: string ): RenameRequest {
        return {
            appName: 'Accounts Demos',
            walletId,
            address,
        };
    }

    public async updateAccounts() {
        const wallets = await this.list();
        console.log('Accounts in Manager:', wallets);

        const $ul = document.querySelector('#accounts');
        let html = '';

        wallets.forEach(wallet => {
            html += `<li${wallet.keyMissing ? ' style="color:red;"' : ''}>${wallet.label}<br>
                        <button class="export" data-wallet-id="${wallet.id}">Export</button>
                        <button class="change-passphrase" data-wallet-id="${wallet.id}">Ch. Pass.</button>
                        ${wallet.type !== 0 ? `<button class="add-account" data-wallet-id="${wallet.id}">+ Acc</button>` : ''}
                        <button class="rename" data-wallet-id="${wallet.id}">Rename</button>
                        <button class="logout" data-wallet-id="${wallet.id}">Logout</button>
                        <ul>`;
            wallet.accounts.forEach((acc, addr) => {
                html += `
                            <li>
                                <label>
                                    <input type="radio" name="sign-tx-address" data-address="${addr}" data-wallet-id="${wallet.id}">
                                    ${acc.label}
                                    <button class="rename" data-wallet-id="${wallet.id}" data-address="${addr}">Rename</button>
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
        document.querySelectorAll('button.change-passphrase').forEach(element => {
            element.addEventListener('click', async () => this.changePassphrase(element.getAttribute('data-wallet-id')));
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
