/// <reference path="../node_modules/@nimiq/core-types/Nimiq.d.ts" />

import * as Rpc from '@nimiq/rpc';
import AccountsManagerClient from '../client/AccountsManagerClient';
import {RequestType, SignupRequest, SignupResult, CheckoutRequest, CheckoutResult, LoginRequest, LoginResult, SignTransactionRequest} from '../src/lib/RequestTypes';
// import { KeyStore } from '../src/lib/KeyStore';
// import { KeyInfo, KeyStorageType } from '../src/lib/KeyInfo';
// import { AddressInfo } from '../src/lib/AddressInfo';

class Demo {
    // public static ENTROPY = 'abb107d2c9adafed0b2ff41c0cfbe4ad4352b11362c5ca83bb4fc7faa7d4cf69';
    // public static DEFAULT_PATH1 = 'm/0\'/0\'';
    // public static DEFAULT_ADDRESS1 = 'NQ07 EF7P 70FR VLLX RP3X TN8Y FJ6V 4FF8 4KAE';
    // public static DEFAULT_PATH2 = 'm/0\'/1\'';
    // public static DEFAULT_ADDRESS2 = 'NQ21 AFH7 VDUF LSCY AVX4 3RH2 4VCG VXY3 USK0';

    public static run() {
        (async () => {
            await Nimiq.WasmHelper.doImportBrowser();
            Nimiq.GenesisConfig.test();
            document.querySelectorAll('button').forEach(button => button.disabled = false);
        })();

        const demo = new Demo('http://localhost:8000');

        const client = new AccountsManagerClient('http://localhost:8080');
        // client.on(RequestType.CHECKOUT, (result: CheckoutResult, state: Rpc.State) => {
        //     console.log('AccountsManager result', result);
        //     console.log('State', state);

        //     document.querySelector('#result').textContent = 'TX signed';
        //     demo.tearDownKey().catch(console.error);
        // }, (error: Error, state: Rpc.State) => {
        //     console.error('AccountsManager error', error);
        //     console.log('State', state);

        //     document.querySelector('#result').textContent = `Error: ${error.message || error}`;
        //     demo.tearDownKey().catch(console.error);
        // });
        // client.on(RequestType.SIGNUP, (result: SignupResult, state: Rpc.State) => {
        //     alert('Wut?');
        // }, (error: Error, state: Rpc.State) => {
        //     alert('Error wut?');
        // });
        // client.init();

        // document.querySelector('button#checkout-redirect').addEventListener('click', async () => {
        //     checkoutRedirect(await generateCheckoutRequest(demo));
        // });

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
            const value = parseInt((document.querySelector('#value') as HTMLInputElement).value) || 1337;
            const fee = parseInt((document.querySelector('#fee') as HTMLInputElement).value) || 0;
            const txData = (document.querySelector('#data') as HTMLInputElement).value || '';

            return {
                appName: 'Accounts Demos',
                keyId: 'ad6a561d41e3',
                sender: 'NQ70 QCHH B708 XQ1N GRHR U1M3 HBG3 KEPP HDJL',
                recipient: 'NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU',
                value,
                fee,
                data: Nimiq.BufferUtils.fromAscii(txData),
                validityStartHeight: 1234,
            };
        }

        async function generateCheckoutRequest(demo: Demo): Promise<CheckoutRequest> {
            const value = parseInt((document.querySelector('#value') as HTMLInputElement).value) || 1337;
            const txFee = parseInt((document.querySelector('#fee') as HTMLInputElement).value) || 0;
            const txData = (document.querySelector('#data') as HTMLInputElement).value || '';
            // const keyPassphrase = (document.querySelector('#passphrase') as HTMLInputElement).value || '';

            // await demo.setUpKey(keyPassphrase);

            return {
                appName: 'Accounts Demos',
                recipient: Nimiq.Address.fromUserFriendlyAddress('NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU').serialize(),
                value,
                fee: txFee,
                data: Nimiq.BufferUtils.fromAscii(txData)
            };
        }

        // function checkoutRedirect(txRequest: CheckoutRequest) {
        //     return client.checkout(txRequest);
        // }

        async function checkoutPopup(txRequest: CheckoutRequest) {
            try {
                const result = await client.checkout(txRequest);
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'TX signed';
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }

            // await demo.tearDownKey();
        }

        document.querySelector('button#list-keyguard-keys').addEventListener('click', () => demo.listKeyguard());
        document.querySelector('button#list-accounts').addEventListener('click', async () => {
            const keys = await client.list();
            console.log('Accounts in Manager:', keys);
        });
    } // run

    // private static _deriveAddressInfo(entropy: Nimiq.Entropy, path: string): AddressInfo {
    //     return new AddressInfo(
    //         path,
    //         'Standard Account',
    //         Demo._deriveAddress(entropy, path),
    //     );
    // }

    // private static _deriveAddress(entropy: Nimiq.Entropy, path: string): Nimiq.Address {
    //     const privKey = entropy.toExtendedPrivateKey().derivePath(path).privateKey;
    //     const pubKey = Nimiq.PublicKey.derive(privKey);
    //     return pubKey.toAddress();
    // }

    // private static _keyIdFromEntropy(entropy: Nimiq.Entropy): string {
    //     return Nimiq.BufferUtils.toHex(Nimiq.Hash.blake2b(entropy.serialize()).subarray(0, 6));
    // }

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

    // public async setUpKey(keyPassphrase?: string) {
    //     // Local setUpKey first
    //     const entropy = new Nimiq.Entropy(Nimiq.BufferUtils.fromHex(Demo.ENTROPY));

    //     const addresses: Map<string, AddressInfo> = new Map();
    //     addresses.set(Demo.DEFAULT_ADDRESS1, Demo._deriveAddressInfo(entropy, Demo.DEFAULT_PATH1));
    //     addresses.set(Demo.DEFAULT_ADDRESS2, Demo._deriveAddressInfo(entropy, Demo.DEFAULT_PATH2));

    //     const keyInfo = new KeyInfo(
    //         Demo._keyIdFromEntropy(entropy),
    //         'KeyLabel',
    //         addresses,
    //         [],
    //         KeyStorageType.BIP39,
    //     );

    //     await KeyStore.Instance.put(keyInfo);
    //     await KeyStore.Instance.close();

    //     // Then remote setUpKey
    //     const keyguardSetup = await this.startIframeClient(this._keyguardBaseUrl);
    //     await keyguardSetup.call('setUpKey', keyPassphrase);
    // }

    // public async tearDownKey() {
    //     // Local tearDownKey
    //     const entropy = new Nimiq.Entropy(Nimiq.BufferUtils.fromHex(Demo.ENTROPY));

    //     await KeyStore.Instance.remove(Demo._keyIdFromEntropy(entropy));
    //     await KeyStore.Instance.close();

    //     // Then remote tearDownKey
    //     const keyguardSetup = await this.startIframeClient(this._keyguardBaseUrl);
    //     await keyguardSetup.call('tearDownKey');
    // }

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
    }
} // class Demo

Demo.run();
