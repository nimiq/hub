import { State, PostMessageRpcClient } from '@nimiq/rpc';
import HubApi from '../client/HubApi';
import {
    SimpleRequest,
    Account,
    CheckoutRequest,
    SimpleResult,
    SignTransactionRequest,
    RenameRequest,
    SignMessageRequest,
    ExportRequest,
    Cashlink,
    RpcResult,
    CreateCashlinkRequest,
    SignBtcTransactionRequest,
    CashlinkTheme,
    RequestType,
    SetupSwapRequest,
    SignMultisigTransactionRequest,
    ConnectAccountRequest,
    ConnectedAccount,
    EncryptionKeyParams,
} from '../client/PublicRequestTypes';
import { RedirectRequestBehavior, PopupRequestBehavior } from '../client/RequestBehavior';
import { Utf8Tools } from '@nimiq/utils';
import { WalletType } from '../src/lib/Constants';
import { WalletStore } from '../src/lib/WalletStore';

// BitcoinJS is defined as a global variable in BitcoinJS.min.js loaded by demos/index.html
declare global {
    const BitcoinJS: typeof import('bitcoinjs-lib');
}

class Demo {
    public static run() {
        const keyguardOrigin = location.origin === 'https://hub.v2.nimiq-testnet.com'
            ? 'https://keyguard.v2.nimiq-testnet.com'
            : `${location.protocol}//${location.hostname}:8000`;
        const demo = new Demo(keyguardOrigin);
        // @ts-ignore (Property 'demo' does not exist on type 'Window')
        window.demo = demo;

        Object.values(RequestType).forEach((requestType) => {
            demo.client.on(requestType, (result: RpcResult, state: State) => {
                console.log('Hub result', result);
                console.log('State', state);

                document.querySelector('#result')!.textContent = JSON.stringify(result);
                if (requestType === RequestType.CONNECT_ACCOUNT) {
                    setConnectResult(result as ConnectedAccount);
                }
            }, (error: Error, state: State) => {
                console.error('Hub error', error);
                console.log('State', state);

                document.querySelector('#result')!.textContent = `Error: ${error.message || error}`;
            });
        });
        demo.client.checkRedirectResponse();

        document.querySelectorAll('input[name="popup-vs-redirect"]').forEach((input) => {
            input.addEventListener('change', (event) => {
                const value = (event.target as HTMLInputElement).value;
                demo.setClientBehavior(value);
            });
        });
        demo.setClientBehavior(
            (document.querySelector('input[name="popup-vs-redirect"]:checked') as HTMLInputElement).value);

        document.querySelector('button#checkout')!.addEventListener('click', async () => {
            await checkout(await generateCheckoutRequest());
        });

        document.querySelector('button#multi-checkout')!.addEventListener('click', async () => {
            await checkout(await generateCheckoutRequest(/* multiCheckout */ true));
        });

        const $returnLinkCheckbox = document.querySelector('#cashlink-return-link') as HTMLInputElement;
        $returnLinkCheckbox.addEventListener('change', () => {
            (document.querySelector('#cashlink-skip-sharing-container') as HTMLElement).style.display =
                $returnLinkCheckbox.checked ? 'block' : 'none';
        });

        const themeSelector = document.querySelector('#cashlink-theme') as HTMLSelectElement;
        Object.entries(CashlinkTheme).forEach(([themeName, themeId]) => {
            // filter out entries added by typescript for reverse mapping
            if (typeof themeId !== 'number') return;
            const option = document.createElement('option');
            option.text = themeName;
            option.value = themeId.toString();
            themeSelector.add(option);
        });

        document.querySelector('button#create-cashlink')!.addEventListener('click', async () => {
            try {
                let value: number | undefined =
                    parseInt((document.querySelector('#cashlink-value') as HTMLInputElement).value);
                value = !Number.isNaN(value) ? value : undefined;

                let message: string | undefined =
                    (document.querySelector('#cashlink-message') as HTMLInputElement).value;
                message = !!message ? message : undefined;

                const autoTruncateMessage: boolean =
                    (document.querySelector('#cashlink-auto-truncate-message') as HTMLInputElement).checked;

                let theme: CashlinkTheme | undefined = Number.parseInt(themeSelector.value);
                theme = !Number.isNaN(theme) ? theme : undefined;

                let request: CreateCashlinkRequest = {
                    appName: 'Hub Demos',
                    value,
                    message,
                    autoTruncateMessage,
                    theme,
                };

                const useSelectedAddress = (document.querySelector(
                    '#cashlink-use-selected-address') as HTMLInputElement).checked;
                if (useSelectedAddress) {
                    const $addressRadio = document.querySelector('input[name="address"]:checked');
                    if (!$addressRadio) {
                        alert('You have no account to send a cashlink from, create an account first (signup)');
                        throw new Error('No account found');
                    }
                    request = {
                        ...request,
                        senderAddress: ($addressRadio as HTMLInputElement).dataset.address,
                        senderBalance: 5e5, // just set an arbitrary balance for testing
                    };
                }

                const returnLink = $returnLinkCheckbox.checked;
                if (returnLink) {
                    const skipSharing = (document.querySelector(
                        '#cashlink-skip-sharing') as HTMLInputElement).checked;
                    request = {
                        ...request,
                        returnLink,
                        skipSharing,
                    };
                }

                const result = await demo.client.createCashlink(request, demo._defaultBehavior as PopupRequestBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = `Cashlink created${result.link
                    ? `: ${result.link}`
                    : ''
                }`;
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#choose-address')!.addEventListener('click', async () => {
            try {
                const result = await demo.client.chooseAddress({ appName: 'Hub Demos', ui: 2 }, demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = `Address was chosen: ${result ? result.address : '-'}`;
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#choose-address-and-btc')!.addEventListener('click', async () => {
            try {
                const result = await demo.client.chooseAddress({ appName: 'Hub Demos', returnBtcAddress: true, ui: 2 }, demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = `Address was chosen: ${result ? result.address : '-'}`;
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#sign-transaction')!.addEventListener('click', async () => {
            const txRequest = generateSignTransactionRequest();
            try {
                const result = await demo.client.signTransaction(
                    new Promise<SignTransactionRequest>((resolve) => {
                        window.setTimeout(() => resolve(txRequest), 2000);
                    }),
                    demo._defaultBehavior,
                );
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'TX signed';
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#onboard')!.addEventListener('click', async () => {
            try {
                const result = await demo.client.onboard({ appName: 'Hub Demos' }, demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'Onboarding completed!';
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#create')!.addEventListener('click', async () => {
            try {
                const result = await demo.client.signup({ appName: 'Hub Demos' }, demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'New account & address created';
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#login')!.addEventListener('click', async () => {
            try {
                const result = await demo.client.login({ appName: 'Hub Demos' }, demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'Account imported';
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        function generateSignTransactionRequest(): SignTransactionRequest {
            const $radio = document.querySelector('input[name="address"]:checked');
            if (!$radio) {
                alert('You have no account to send a tx from, create an account first (signup)');
                throw new Error('No account found');
            }
            const sender = ($radio as HTMLElement).dataset.address!;
            const value = parseInt((document.querySelector('#value') as HTMLInputElement).value, 10) || 1337;
            const fee = parseInt((document.querySelector('#fee') as HTMLInputElement).value, 10) || 0;
            const txData = (document.querySelector('#data') as HTMLInputElement).value || '';
            const validityStartHeight = (document.querySelector('#validitystartheight') as HTMLInputElement).value
                || '1234';

            return {
                appName: 'Hub Demos',
                sender,
                recipient: 'NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU',
                value,
                fee,
                extraData: Utf8Tools.stringToUtf8ByteArray(txData),
                validityStartHeight: parseInt(validityStartHeight, 10),
            };
        }

        async function generateCheckoutRequest(multiCheckout?: boolean): Promise<CheckoutRequest> {
            const nimTxValue = parseInt((document.querySelector('#value') as HTMLInputElement).value, 10) || 1337;
            const nimTxFee = parseInt((document.querySelector('#fee') as HTMLInputElement).value, 10) || 0;
            const nimTxData = (document.querySelector('#data') as HTMLInputElement).value || '';

            let sender: string | undefined;
            const useSelectedAddress = (document.getElementById(
                'checkout-use-selected-address') as HTMLInputElement).checked;
            if (useSelectedAddress) {
                const $addressRadio = document.querySelector('input[name="address"]:checked');
                if (!$addressRadio) {
                    alert('You have no account to checkout with, create an account first (signup)');
                    throw new Error('No account found');
                }
                sender = ($addressRadio as HTMLElement).dataset.address;
            }
            const forceSender = (document.getElementById('checkout-force-sender') as HTMLInputElement).checked;

            const isPointOfSale = (document.getElementById('checkout-is-point-of-sale') as HTMLInputElement).checked;

            if (!multiCheckout) {
                // v1 checkout: nim only
                return {
                    appName: 'Hub Demos',
                    shopLogoUrl: `${location.origin}/nimiq.png`,
                    sender,
                    forceSender,
                    recipient: 'NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU',
                    value: nimTxValue,
                    fee: nimTxFee,
                    extraData: Utf8Tools.stringToUtf8ByteArray(nimTxData),
                    isPointOfSale,
                };
            } else {
                const now = Date.now();
                return {
                    version: 2,
                    appName: 'Hub Demos',
                    shopLogoUrl: `${location.origin}/nimiq.png`,
                    callbackUrl: `${location.origin}/callback.html`,
                    csrf: 'dummy-csrf-token',
                    time: now,
                    fiatCurrency: 'EUR',
                    fiatAmount: 24.99,
                    isPointOfSale,
                    paymentOptions: [
                        {
                            currency: HubApi.Currency.BTC,
                            type: HubApi.PaymentType.DIRECT,
                            amount: '.00029e8',
                            vendorMarkup: .01,
                            expires: now + 3 * 60000, // 15 minutes
                            protocolSpecific: {
                                feePerByte: 2, // 2 sat per byte
                                recipient: '17w6ar5SqXFGr786WjGHB8xyu48eujHaBe', // Unicef
                            },
                        },
                        {
                            currency: HubApi.Currency.NIM,
                            type: HubApi.PaymentType.DIRECT,
                            amount: nimTxValue.toString(),
                            vendorMarkup: 0,
                            expires: now + 3 * 60000, // 15 minutes
                            protocolSpecific: {
                                sender,
                                forceSender,
                                fee: nimTxFee,
                                extraData: nimTxData,
                            },
                        },
                        {
                            currency: HubApi.Currency.ETH,
                            type: HubApi.PaymentType.DIRECT,
                            amount: '.0091e18',
                            expires: now + 3 * 60000, // 15 minutes
                            protocolSpecific: {
                                gasLimit: 21000,
                                gasPrice: '2e9',
                                recipient: '0xa4725d6477644286b354288b51122a808389be83', // the water project
                            },
                        },
                    ],
                };
            }
        }

        async function checkout(txRequest: CheckoutRequest) {
            try {
                const result = await demo.client.checkout(txRequest, demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'TX signed';
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        }

        document.querySelector('button#sign-message')!.addEventListener('click', async () => {
            const request: SignMessageRequest = {
                appName: 'Hub Demos',
                // signer: 'NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU',
                message: (document.querySelector('#message') as HTMLInputElement).value || '',
            };
            try {
                const result = await demo.client.signMessage(request, demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'MSG signed: ' + request.message;
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#sign-message-with-account')!.addEventListener('click', async () => {
            const $radio = document.querySelector('input[name="address"]:checked');
            if (!$radio) {
                alert('You have no account to sign a message by, create an account first (signup)');
                throw new Error('No account found');
            }
            const signer = ($radio as HTMLElement).dataset.address;

            const request: SignMessageRequest = {
                appName: 'Hub Demos',
                signer,
                message: (document.querySelector('#message') as HTMLInputElement).value || '',
            };

            try {
                const result = await demo.client.signMessage(request, demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'MSG signed: ' + request.message;
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#sign-message-with-tabs')!.addEventListener('click', async () => {
            const $radio = document.querySelector('input[name="address"]:checked');
            const signer = $radio && ($radio as HTMLElement).dataset.address || undefined;

            const request: SignMessageRequest = {
                appName: 'Hub Demos',
                signer,
                message: `This is a\n\tmessage\n\twith tabs.\n\n\t\tTouble tab!`,
            };

            try {
                const result = await demo.client.signMessage(request, demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'MSG signed: ' + request.message;
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#migrate')!.addEventListener('click', async () => {
            try {
                const result = await demo.client.migrate(demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'Migrated';
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#activate-btc')!.addEventListener('click', async () => {
            const $radio = document.querySelector('input[name="address"]:checked');
            if (!$radio) {
                alert('You have no account to activate BTC for, create an account first (signup)');
                throw new Error('No account found');
            }
            const accountId = $radio.closest('ul')!.closest('li')!.querySelector('button')!.dataset.walletId!;

            const wallet = await WalletStore.Instance.get(accountId);
            if (!wallet) throw new Error('Account not found');

            if (wallet.btcXPub || wallet.btcAddresses.external.length || wallet.btcAddresses.internal.length) {
                if (!confirm('Btc support is already activated for the selected account. Do you want to clear the '
                    + 'account\'s Bitcoin metadata and re-activate BTC support?')) {
                    document.querySelector('#result')!.textContent = 'Activation cancelled';
                    return;
                }
                wallet.btcXPub = undefined;
                wallet.btcAddresses = { external: [], internal: [] };
                await WalletStore.Instance.put(wallet);
            }

            try {
                const result = await demo.client.activateBitcoin({
                    appName: 'Hub Demos',
                    accountId,
                }, demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'Activated account: ' + JSON.stringify(result);
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#sign-btc-transaction')!.addEventListener('click', async () => {
            const $radio = document.querySelector('input[name="address"]:checked');
            if (!$radio) {
                alert('You have no account to send a tx from, create an account first (signup)');
                throw new Error('No account found');
            }
            const accountId = $radio.closest('ul')!.closest('li')!.querySelector('button')!.dataset.walletId!;

            const account = (await demo.list()).find((wallet) => wallet.accountId === accountId)!;
            if (account.type === WalletType.LEGACY) {
                alert('Cannot sign BTC transactions with a legacy account');
                throw new Error('Cannot use legacy account');
            }

            const senderAddress = account.btcAddresses ? account.btcAddresses.external[0] : null;
            if (!senderAddress) {
                alert('No BTC address found in account, activate Bitcoin for this account first');
                throw new Error('No BTC address found');
            }

            const txRequest: SignBtcTransactionRequest = {
                appName: 'Hub Demos',
                accountId,
                inputs: [{
                    address: senderAddress,
                    transactionHash: 'ef4aaf6087d0cc48ff09355d715c257078467ca4d9dd75a20824e70a78fb43cc',
                    outputIndex: 0,
                    outputScript: BitcoinJS.address.toOutputScript(senderAddress, BitcoinJS.networks.testnet).toString('hex'),
                    value: Math.round(0.010 * 1e8),
                }],
                output: {
                    address: 'tb1qegge25w53hyv4lyye4w3ntsj9gg5j2l7fej0ze',
                    value: Math.round(0.009 * 1e8),
                    label: 'Paul McCartney',
                },
                // changeOutput: {
                //     keyPath: 'm/49\'/1\'/0\'/1/0',
                //     address: '',
                //     value: 0,
                // },
            };
            try {
                const result = await demo.client.signBtcTransaction(txRequest, demo._defaultBehavior as PopupRequestBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'Signed: ' + result.serializedTx;
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#setup-swap.nim-to-btc')!.addEventListener('click', async () => {
            const $radio = document.querySelector('input[name="address"]:checked');
            if (!$radio) {
                alert('You have no account to swap with, create an account first (signup)');
                throw new Error('No account found');
            }
            const accountId = $radio.closest('ul')!.closest('li')!.querySelector('button')!.dataset.walletId!;

            const account = (await demo.list()).find((wallet) => wallet.accountId === accountId);
            if (!account) {
                alert('Account not found.');
                throw new Error('Account not found');
            }

            if (account.type === WalletType.LEGACY) {
                alert('Cannot swap with a legacy account');
                throw new Error('Cannot use legacy account');
            }

            const redeemAddress = account.btcAddresses ? account.btcAddresses.external[0] : null;
            if (!redeemAddress) {
                alert('No BTC address found in account, activate Bitcoin for this account first');
                throw new Error('No BTC address found');
            }

            const request: SetupSwapRequest = {
                appName: 'Hub Demos',
                accountId,
                swapId: 'example-swap-id',
                fund: {
                    type: 'NIM',
                    sender: account.addresses[0].address,
                    value: 2709.79904 * 1e5,
                    fee: 0,
                    validityStartHeight: 1140000,
                },
                redeem: {
                    type: 'BTC',
                    input: {
                        value: Math.round(0.001004 * 1e8),
                    },
                    output: {
                        address: redeemAddress,
                        value: 0.001 * 1e8,
                    },
                },

                fiatCurrency: 'eur',
                fundingFiatRate: 0.00267,
                redeemingFiatRate: 8662.93,
                fundFees: {
                    redeeming: 10.73171 * 1e5,
                    processing: 0,
                },
                redeemFees: {
                    funding: 0,
                    processing: 0,
                },
                serviceSwapFee: 5.40878 * 1e5,
                nimiqAddresses: account.addresses.map((address) => ({
                    address: address.address,
                    balance: Math.round(Math.random() * 10000 + 3000) * 1e5,
                })),
                bitcoinAccount: {
                    balance: Math.round((Math.random() * 0.001 + 0.001) * 1e8),
                },
            };
            try {
                const result = await demo.client.setupSwap(request, demo._defaultBehavior as PopupRequestBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.innerHTML = `Signed successfully!<br>NIM:&nbsp;${result.nim!.serializedTx}<br>BTC:&nbsp;${result.btc!.serializedTx}`;
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#setup-swap.btc-to-nim')!.addEventListener('click', async () => {
            const $radio = document.querySelector('input[name="address"]:checked');
            if (!$radio) {
                alert('You have no account to swap with, create an account first (signup)');
                throw new Error('No account found');
            }
            const accountId = $radio.closest('ul')!.closest('li')!.querySelector('button')!.dataset.walletId!;

            const account = (await demo.list()).find((wallet) => wallet.accountId === accountId);
            if (!account) {
                alert('Account not found.');
                throw new Error('Account not found');
            }

            if (account.type === WalletType.LEGACY) {
                alert('Cannot swap with a legacy account');
                throw new Error('Cannot use legacy account');
            }

            const refundAddress = account.btcAddresses ? account.btcAddresses.external[0] : null;
            if (!refundAddress) {
                alert('No BTC address found in account, activate Bitcoin for this account first');
                throw new Error('No BTC address found');
            }

            const request: SetupSwapRequest = {
                appName: 'Hub Demos',
                accountId,
                swapId: 'example-swap-id',
                fund: {
                    type: 'BTC',
                    inputs: [{
                        address: refundAddress,
                        transactionHash: 'ef4aaf6087d0cc48ff09355d715c257078467ca4d9dd75a20824e70a78fb43cc',
                        outputIndex: 0,
                        outputScript: BitcoinJS.address.toOutputScript(refundAddress, BitcoinJS.networks.testnet).toString('hex'),
                        value: 0.00076136 * 1e8,
                    }],
                    output: {
                        value: 0.00075736 * 1e8,
                    },
                    refundAddress: refundAddress,
                },
                redeem: {
                    type: 'NIM',
                    recipient: account.addresses[0].address,
                    value: 2000 * 1e5,
                    fee: 0,
                    validityStartHeight: 1140135,
                },

                fiatCurrency: 'eur',
                redeemingFiatRate: 0.00267,
                fundingFiatRate: 8662.93,
                fundFees: {
                    redeeming: 0.000004 * 1e8,
                    processing: 0,
                },
                redeemFees: {
                    funding: 0,
                    processing: 0,
                },
                serviceSwapFee: Math.round(0.00000151168 * 1e8),
                nimiqAddresses: account.addresses.map((address) => ({
                    address: address.address,
                    balance: Math.round(Math.random() * 5000) * 1e5,
                })),
                bitcoinAccount: {
                    balance: Math.round((Math.random() * 0.001 + 0.001) * 1e8),
                },
            };
            try {
                const result = await demo.client.setupSwap(request, demo._defaultBehavior as PopupRequestBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.innerHTML = `Signed successfully!<br>NIM:&nbsp;${result.nim!.serializedTx}<br>BTC:&nbsp;${result.btc!.serializedTx}`;
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#activate-usdc')!.addEventListener('click', async () => {
            const $radio = document.querySelector('input[name="address"]:checked');
            if (!$radio) {
                alert('You have no account to activate USDC for, create an account first (signup)');
                throw new Error('No account found');
            }
            const accountId = $radio.closest('ul')!.closest('li')!.querySelector('button')!.dataset.walletId!;

            const wallet = await WalletStore.Instance.get(accountId);
            if (!wallet) throw new Error('Account not found');

            if (wallet.polygonAddresses?.length) {
                if (!confirm('USDC support is already activated for the selected account. Do you want to clear the '
                    + 'account\'s Polygon metadata and re-activate USDC support?')) {
                    document.querySelector('#result')!.textContent = 'Activation cancelled';
                    return;
                }
                wallet.polygonAddresses = [];
                await WalletStore.Instance.put(wallet);
            }

            try {
                const result = await demo.client.activatePolygon({
                    appName: 'Hub Demos',
                    accountId,
                }, demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'Activated USDC: ' + JSON.stringify(result);
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#connect-account')!.addEventListener('click', async () => {
            const request: ConnectAccountRequest = {
                appName: 'Hub Demos',
                appLogoUrl: `${location.origin}/nimiq.png`,
                permissions: [RequestType.SIGN_MULTISIG_TRANSACTION],
                requestedKeyPaths: [`m/44'/242'/0'/0'`],
                challenge: 'sign-this-to-proof-yourself',
            };

            try {
                const [Nimiq, result] = await Promise.all([
                    window.loadAlbatross(),
                    demo.client.connectAccount(request, demo._defaultBehavior),
                ]);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'Account connected: ' + result!.account.label;
                await setConnectResult(result!);
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        async function setConnectResult(result: ConnectedAccount) {
            const Nimiq = await window.loadAlbatross();
            (document.querySelector('#connected-publickey') as HTMLInputElement).value =
                Nimiq.BufferUtils.toHex(result.signatures[0].signerPublicKey);
            (document.querySelector('#connected-encryption-key') as HTMLInputElement).value = JSON.stringify(
                result.encryptionKey,
                (key, value) => key === 'keyData' ? Nimiq.BufferUtils.toHex(value) : value,
            );
        }

        document.querySelector('button#sign-multisig-transaction')!.addEventListener('click', async () => {
            // TODO until the primitives required for multisigs are available in the regular @nimiq/core package, we use
            //  a temporary build. This should be removed when the required primitives are available in @nimiq/core. As
            //  an alternative, the commitments and public key aggregation from legacy core-js should be compatible, or
            //  also https://github.com/nimiq/nimiq-multisig-app/tree/master/wasm/server/pkg could be used as a more
            //  complete and more modern alternative. However, as that is not open source yet, it can not be used by
            //  external people yet, and also not via gitpkg.now.sh or jsdelivr. We'd have to build it as a local
            //  package and add the package's .tgz to the Hub repo, which I currently opted to not do.
            const {
                default: initWasm,
                PrivateKey,
                PublicKey,
                Address,
                CommitmentPair,
                BufferUtils,
            } = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/gh/nimiq/core-rs-albatross@06999e1626b3312a906a0a490339d7feb781811b'
                + '/web-client/dist/web/index.js');
            await initWasm();

            const myPublicKeyHex = (document.querySelector('#connected-publickey') as HTMLInputElement).value;
            if (myPublicKeyHex.length !== 64) {
                alert('Invalid public key. Enter your public key in HEX format');
                throw new Error('Invalid public key');
            }

            const encryptionKeyJson = (document.querySelector('#connected-encryption-key') as HTMLInputElement).value;
            const encryptCommitmentSecrets = (document.querySelector('#multisig-checkbox-encrypt') as HTMLInputElement).checked;
            if (encryptCommitmentSecrets && !encryptionKeyJson) {
                alert('Encryption key must be set, if encryption is enabled.');
                throw new Error('Encryption key missing');
            }
            let encryptionKey: { key: CryptoKey, keyParams: EncryptionKeyParams } | null = null;
            if (encryptCommitmentSecrets) {
                const encryptionKeyInfo = JSON.parse(
                    encryptionKeyJson,
                    (key, value) => key === 'keyData' ? BufferUtils.fromHex(value) : value,
                ) as ConnectedAccount['encryptionKey'];
                const key = await window.crypto.subtle.importKey(
                    encryptionKeyInfo.format,
                    encryptionKeyInfo.keyData,
                    encryptionKeyInfo.algorithm,
                    true, // public key is fine to be extractable
                    encryptionKeyInfo.keyUsages,
                );
                encryptionKey = { key, keyParams: encryptionKeyInfo.keyParams };
            }

            const transactionValue = parseInt((document.querySelector('#multisig-value') as HTMLInputElement).value)
                * 1e5;
            const transactionData = (document.querySelector('#multisig-data') as HTMLInputElement).value;
            const numberOfSigners = parseInt((document.querySelector('#multisig-signers') as HTMLInputElement).value);
            const numberOfKeys = parseInt((document.querySelector('#multisig-participants') as HTMLInputElement).value);
            const userName = (document.querySelector('#multisig-username') as HTMLInputElement).value;

            // One key difference between the multisig implementation in Nimiq PoW's core-js and Musig2 in Nimiq PoS's
            // core-rs-albatross is that Musig2 uses multiple commitments per signer, specified via MUSIG2_PARAMETER_V.
            // Other details like the aggregation of public keys and the calculation of Multisig addresses are identical
            // between core-js and core-rs-albatross. In fact, multisigs created with core-js can be used with Musig2 by
            // simply creating multiple commitments.
            const MUSIG2_PARAMETER_V = 2;
            const generateCommitmentPairs = () => Array.from<unknown, InstanceType<typeof CommitmentPair>>(
                { length: MUSIG2_PARAMETER_V },
                () => CommitmentPair.generate(),
            );

            // Collect owner public keys of potential signers of the multisig.
            const myPublicKey = PublicKey.fromHex(myPublicKeyHex);
            const publicKeys = [myPublicKey]; // my pubkey first, so it's included in the signer subset
            for (let i = 1; i < numberOfKeys; i++) {
                const privateKey = PrivateKey.generate();
                const publicKey = PublicKey.derive(privateKey);
                publicKeys.push(publicKey);
            }
            // Calculate the multisig address from the public keys.
            const multiSigAddress = Address.fromPublicKeys(publicKeys, numberOfSigners);

            // Collect commitments for the subset of publicKeys that sign the transaction
            const myCommitmentPairs = generateCommitmentPairs();
            const signers = [{
                publicKey: myPublicKey,
                commitments: myCommitmentPairs.map(({ commitment }) => commitment),
            }];
            for (let i = 1; i < numberOfSigners; i++) {
                const publicKey = publicKeys[i];
                const commitments = generateCommitmentPairs().map(({ commitment }) => commitment);
                signers.push({ publicKey, commitments });
            }
            const myCommitmentSecrets = encryptionKey
                ? {
                    encrypted: (await Promise.all(myCommitmentPairs.map(({ secret }) => window.crypto.subtle.encrypt(
                        encryptionKey.key.algorithm,
                        encryptionKey.key,
                        secret.serialize(),
                    )))).map((encryptedSecret) => BufferUtils.toHex(new Uint8Array(encryptedSecret))),
                    keyParams: encryptionKey.keyParams,
                }
                : myCommitmentPairs.map(({ secret }) => secret.toHex());

            // Partially sign the transaction with our key.
            // This demo does not cover creating partial signatures for the other signers and aggregating the final
            // transaction signature.
            const request: SignMultisigTransactionRequest = {
                appName: 'Hub Demos',

                signer: myPublicKey.toAddress().toUserFriendlyAddress(),

                sender: multiSigAddress.toUserFriendlyAddress(),
                senderLabel: 'Our Multisig Wallet',
                recipient: 'NQ82 HP54 C9D4 2FAG 69QD 6Q71 LURR 5187 0V3X',
                recipientLabel: 'Best Friend',
                value: transactionValue,
                // fee: 0,
                extraData: transactionData,
                // flags: 0,
                validityStartHeight: 1,

                multisigConfig: {
                    publicKeys: publicKeys.map((publicKey) => publicKey.toHex()),
                    signers: signers.map(({ publicKey, commitments }) => ({
                        publicKey: publicKey.toHex(),
                        commitments: commitments.map((commitment) => commitment.toHex()),
                    })),
                    secrets: myCommitmentSecrets,
                    userName,
                },
            };

            try {
                const result = await demo.client.signMultisigTransaction(request, demo._defaultBehavior);
                console.log('Result', result);
                document.querySelector('#result')!.textContent = 'Transaction signed: '
                    + BufferUtils.toHex(result!.signature);
            } catch (e) {
                console.error(e);
                document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            }
        });

        document.querySelector('button#list-keyguard-keys')!.addEventListener('click', () => demo.listKeyguard());
        document.querySelector('button#setup-legacy-accounts')!.addEventListener('click',
            () => demo.setupLegacyAccounts());
        document.querySelector('button#list-accounts')!.addEventListener('click', async () => demo.updateAccounts());

        document.querySelectorAll('button').forEach((button) => button.disabled = false);
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
    private _hubApi: HubApi;
    private _defaultBehavior?: RedirectRequestBehavior | PopupRequestBehavior;

    constructor(keyguardBaseUrl: string) {
        this._iframeClient = null;
        this._keyguardBaseUrl = keyguardBaseUrl;
    }

    public async changePassword(accountId: string) {
        try {
            const result = await this.client.changePassword(
                this._createChangePasswordRequest(accountId),
                this._defaultBehavior,
            );
            console.log('Result', result);
            document.querySelector('#result')!.textContent = 'Successfully changed Password';
        } catch (e) {
            console.error(e);
            document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
        }
    }

    public _createChangePasswordRequest(accountId: string): SimpleRequest {
        return {
            appName: 'Hub Demos',
            accountId,
        } as SimpleRequest;
    }

    public async addAccount(accountId: string) {
        try {
            const result = await this.client.addAddress(
                this._createAddAccountRequest(accountId),
                this._defaultBehavior,
            );
            console.log('Result', result);
            document.querySelector('#result')!.textContent = 'Account added';
        } catch (e) {
            console.error(e);
            document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
        }
    }

    public _createAddAccountRequest(accountId: string): SimpleRequest {
        return {
            appName: 'Hub Demos',
            accountId,
        } as SimpleRequest;
    }

    public async rename(accountId: string, account: string) {
        try {
            const result = await this.client.rename(
                this._createRenameRequest(accountId, account),
                this._defaultBehavior,
            );
            console.log('Result', result);
            document.querySelector('#result')!.textContent = 'Done renaming account';
        } catch (e) {
            console.error(e);
            document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
        }
    }

    public _createRenameRequest(accountId: string, address: string ): RenameRequest {
        return {
            appName: 'Hub Demos',
            accountId,
            address,
        };
    }

    public async updateAccounts() {
        const cashlinks = await this.cashlinks();
        let $ul = document.querySelector('#cashlinks')!;
        let cashlinksHtml = '';

        cashlinks.forEach((cashlink) => {
            cashlinksHtml += `
            <li>
                ${cashlink.address}
                <button class="cashlink-manage" data-cashlink-address="${cashlink.address}">manage</button>
            </li>`;
        });

        $ul.innerHTML = cashlinksHtml;
        document.querySelectorAll('button.cashlink-manage').forEach((element) => {
            element.addEventListener('click', () => this.client.manageCashlink({
                appName: 'Hub Demos',
                cashlinkAddress: (element as HTMLElement).dataset.cashlinkAddress!,
            }));
        });

        const wallets = await this.list();
        console.log('Accounts in Manager:', wallets);

        $ul = document.querySelector('#accounts')!;
        let html = '';

        wallets.forEach((wallet) => {
            html += `<li>${wallet.label}<br>
                        <button class="export" data-wallet-id="${wallet.accountId}">Export</button>
                        <button class="export-file" data-wallet-id="${wallet.accountId}">File</button>
                        <button class="export-words" data-wallet-id="${wallet.accountId}">Words</button>
                        <button class="change-password" data-wallet-id="${wallet.accountId}">Ch. Pass.</button>
                        ${wallet.type !== WalletType.LEGACY
                            ? `<button class="add-account" data-wallet-id="${wallet.accountId}">+ Addr</button>`
                            : ''}
                        <button class="rename" data-wallet-id="${wallet.accountId}">Rename</button>
                        <button class="logout" data-wallet-id="${wallet.accountId}">Logout</button>
                        <ul>`;
            wallet.addresses.forEach((acc) => {
                html += `
                    <li>
                        <label>
                            <input type="radio"
                                name="address"
                                data-address="${acc.address}"
                                data-wallet-id="${wallet.accountId}">
                            ${acc.label}
                            <button class="rename" data-wallet-id="${wallet.accountId}" data-address="${acc.address}">
                                Rename
                            </button>
                        </label>
                    </li>
                `;
            });
            wallet.contracts.forEach((con) => {
                html += `
                    <li>
                        <label>
                            <input type="radio"
                                name="address"
                                data-address="${con.address}"
                                data-wallet-id="${wallet.accountId}">
                            <strong>Contract</strong> ${con.label}
                            <button class="rename" data-wallet-id="${wallet.accountId}" data-address="${con.address}">
                                Rename
                            </button>
                        </label>
                    </li>
                `;
            });
            html += '</ul></li>';
        });

        $ul.innerHTML = html;
        if (document.querySelector('input[name="address"]')) {
            (document.querySelector('input[name="address"]') as HTMLInputElement).checked = true;
        }
        document.querySelectorAll('button.export').forEach((element) => {
            element.addEventListener('click', async () => this.export((element as HTMLElement).dataset.walletId!));
        });
        document.querySelectorAll('button.export-file').forEach((element) => {
            element.addEventListener('click', async () => this.exportFile((element as HTMLElement).dataset.walletId!));
        });
        document.querySelectorAll('button.export-words').forEach((element) => {
            element.addEventListener('click', async () => this.exportWords((element as HTMLElement).dataset.walletId!));
        });
        document.querySelectorAll('button.change-password').forEach((element) => {
            element.addEventListener('click',
                async () => this.changePassword((element as HTMLElement).dataset.walletId!));
        });
        document.querySelectorAll('button.rename').forEach((element) => {
            element.addEventListener('click',
                async () => this.rename(
                    (element as HTMLElement).dataset.walletId!,
                    (element as HTMLElement).dataset.address!,
                ),
            );
        });
        document.querySelectorAll('button.add-account').forEach((element) => {
            element.addEventListener('click', async () => this.addAccount((element as HTMLElement).dataset.walletId!));
        });
        document.querySelectorAll('button.logout').forEach((element) => {
            element.addEventListener('click', async () => this.logout((element as HTMLElement).dataset.walletId!));
        });
    }

    public setClientBehavior(behavior: string) {
        if (behavior === 'popup') {
            this._defaultBehavior = undefined; // use the clients default behavior which is popup
        } else if (behavior === 'redirect') {
            this._defaultBehavior = new RedirectRequestBehavior();
        }
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
        const $popup = window.open(url, windowName)!;
        const popupClient = new PostMessageRpcClient($popup, '*');
        await popupClient.init();
        return popupClient;
    }

    public async listKeyguard() {
        const client = await this.startIframeClient(this._keyguardBaseUrl);
        const keys = await client.call('list');
        console.log('Keys in Keyguard:', keys);
        document.querySelector('#result')!.textContent = 'Keys listed in console';
        return keys;
    }

    public async setupLegacyAccounts() {
        const client = await this.startPopupClient(
            `${this._keyguardBaseUrl}/demos/setup.html`, 'Nimiq Keyguard Setup Popup',
        );
        const result = await client.call('setUpLegacyAccounts');
        client.close();
        // @ts-ignore Property '_target' is private and only accessible within class 'PostMessageRpcClient'.
        client._target.close();
        console.log('Legacy Account setup:', result);
        document.querySelector('#result')!.textContent = 'Legacy account stored';
    }

    public async list(): Promise<Account[]> {
        return await this.client.list();
    }

    public async cashlinks(): Promise<Cashlink[]> {
        return await this.client.cashlinks();
    }

    public async logout(accountId: string): Promise<SimpleResult> {
        try {
            const result = await this.client.logout(this._createLogoutRequest(accountId), this._defaultBehavior as PopupRequestBehavior);
            console.log('Result', result);
            document.querySelector('#result')!.textContent = 'Account removed';
            return result;
        } catch (e) {
            console.error(e);
            document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
            throw e;
        }
    }

    public _createLogoutRequest(accountId: string): SimpleRequest {
        return {
            appName: 'Hub Demos',
            accountId,
        } as SimpleRequest;
    }

    public export(accountId: string) {
        this._export({
            appName: 'Hub Demos',
            accountId,
        });
    }

    public exportFile(accountId: string) {
        this._export({
            appName: 'Hub Demos',
            accountId,
            fileOnly: true,
        });
    }

    public exportWords(accountId: string) {
        this._export({
            appName: 'Hub Demos',
            accountId,
            wordsOnly: true,
        });
    }

    private async _export(request: ExportRequest) {
        try {
            const result = await this.client.export(request, this._defaultBehavior as PopupRequestBehavior);
            console.log('Result', result);
            if (result.fileExported) {
                document.querySelector('#result')!.textContent = result.wordsExported
                    ? 'Export sucessful'
                    : 'File exported';
            } else {
                document.querySelector('#result')!.textContent = result.wordsExported
                    ? 'Words exported'
                    : 'nothing exported';
            }
        } catch (e) {
            console.error(e);
            document.querySelector('#result')!.textContent = `Error: ${e.message || e}`;
        }
    }

    public get client() {
        return this._hubApi || (this._hubApi = new HubApi(location.origin));
    }
} // class Demo

Demo.run();
