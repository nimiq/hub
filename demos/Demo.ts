/// <reference path="../node_modules/@nimiq/core-types/Nimiq.d.ts" />

import * as Rpc from '@nimiq/rpc';
import AccountsManagerClient from '../client/AccountsManagerClient';
import {
    RequestType,
    SignupRequest, SignupResult,
    CheckoutRequest,
    LoginRequest, LoginResult,
    SignTransactionRequest, SignTransactionResult
} from '../src/lib/RequestTypes';
import { KeyStore } from '../src/lib/KeyStore';
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

        const client = new AccountsManagerClient('http://localhost:8080');
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
        client.init();

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
                document.querySelector('#result').textContent = 'New key & account created';
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
                document.querySelector('#result').textContent = 'Key imported';
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
            const keyId = $radio.getAttribute('data-keyid');
            const value = parseInt((document.querySelector('#value') as HTMLInputElement).value) || 1337;
            const fee = parseInt((document.querySelector('#fee') as HTMLInputElement).value) || 0;
            const txData = (document.querySelector('#data') as HTMLInputElement).value || '';

            return {
                appName: 'Accounts Demos',
                keyId,
                sender,
                recipient: 'NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU',
                value,
                fee,
                extraData: Nimiq.BufferUtils.fromAscii(txData),
                validityStartHeight: 1234,
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
            return client.checkout(txRequest, new RedirectRequestBehavior());
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

    public async list() {
        return await KeyStore.Instance.list();
    }

    public async updateAccounts() {
        const keys = await this.list();
        console.log('Accounts in Manager:', keys);

        const $ul = document.querySelector('#accounts');
        let html = '';

        keys.forEach(key => {
            html += `<li>${key.label}<ul>`;
            key.addresses.forEach((acc, addr) => {
                html += `
                    <li>
                        <label>
                            <input type="radio" name="sign-tx-address" data-address="${addr}" data-keyid="${key.id}">
                            ${acc.label}
                        </label>
                    </li>
                `;
            });
            html += '</ul></li>';
        });

        $ul.innerHTML = html;
        (document.querySelector('input[type="radio"]') as HTMLInputElement).checked = true;
    }
} // class Demo

Demo.run();
