import { TX_VALIDITY_WINDOW, TX_MIN_VALIDITY_DURATION, isMilliseconds } from './Constants';
import { State } from '@nimiq/rpc';
import {
    BasicRequest,
    SimpleRequest,
    OnboardRequest,
    SignTransactionRequest,
    CheckoutRequest,
    SignMessageRequest,
    RenameRequest,
    ExportRequest,
    RpcRequest,
    Currency,
    PaymentMethod,
    RequestType,
} from './PublicRequestTypes';
import {
    ParsedBasicRequest,
    ParsedSimpleRequest,
    ParsedOnboardRequest,
    ParsedSignTransactionRequest,
    ParsedCheckoutRequest,
    ParsedSignMessageRequest,
    ParsedRenameRequest,
    ParsedExportRequest,
    ParsedRpcRequest,
    ExtendedRpcRequest,
    ExtendedCheckoutRequest,
} from './RequestTypes';
import { ParsedNimiqDirectPaymentOptions } from './paymentOptions/NimiqPaymentOptions';
import { ParsedEtherDirectPaymentOptions } from './paymentOptions/EtherPaymentOptions';
import { ParsedBitcoinDirectPaymentOptions } from './paymentOptions/BitcoinPaymentOptions';
import CurrencyCode from 'currency-codes';
import { Utf8Tools } from '@nimiq/utils';

export class RequestParser {
    public static parse(
            request: RpcRequest | ExtendedRpcRequest,
            state: State,
            requestType: RequestType,
        ): ParsedRpcRequest | null {
        if (!request.appName) throw new Error('appName is required');

        switch (requestType) {
            case RequestType.SIGN_TRANSACTION:
                const signTransactionRequest = request as SignTransactionRequest;

                if (!signTransactionRequest.value) throw new Error('value is required');
                if (!signTransactionRequest.validityStartHeight) throw new Error('validityStartHeight is required');

                return {
                    kind: RequestType.SIGN_TRANSACTION,
                    appName: signTransactionRequest.appName,
                    sender: Nimiq.Address.fromUserFriendlyAddress(signTransactionRequest.sender),
                    recipient: Nimiq.Address.fromUserFriendlyAddress(signTransactionRequest.recipient),
                    recipientType: signTransactionRequest.recipientType || Nimiq.Account.Type.BASIC,
                    value: signTransactionRequest.value,
                    fee: signTransactionRequest.fee || 0,
                    data: typeof signTransactionRequest.extraData === 'string'
                        ? Utf8Tools.stringToUtf8ByteArray(signTransactionRequest.extraData)
                        : signTransactionRequest.extraData || new Uint8Array(0),
                    flags: signTransactionRequest.flags || Nimiq.Transaction.Flag.NONE,
                    validityStartHeight: signTransactionRequest.validityStartHeight,
                } as ParsedSignTransactionRequest;
            case RequestType.CHECKOUT:
                const checkoutRequest = request as CheckoutRequest;

                if (!checkoutRequest.version || checkoutRequest.version === 1) {
                    if (!checkoutRequest!.value) throw new Error('value is required');

                    if (checkoutRequest.shopLogoUrl && new URL(checkoutRequest.shopLogoUrl).origin !== state.origin) {
                        throw new Error(
                            'shopLogoUrl must have same origin as caller website. Image at ' +
                            checkoutRequest.shopLogoUrl +
                            ' is not on caller origin ' +
                            state.origin);
                    }

                    return {
                        kind: RequestType.CHECKOUT,
                        appName: checkoutRequest.appName,
                        shopLogoUrl: checkoutRequest.shopLogoUrl,
                        data: typeof checkoutRequest.extraData === 'string'
                            ? Utf8Tools.stringToUtf8ByteArray(checkoutRequest.extraData)
                            : checkoutRequest.extraData || new Uint8Array(0),
                        time: + new Date(),
                        paymentOptions: [new ParsedNimiqDirectPaymentOptions({
                            currency: Currency.NIM,
                            type: PaymentMethod.DIRECT,
                            amount: checkoutRequest.value.toString(),
                            expires: 0, // unused for NimiqCheckoutRequests
                            protocolSpecific: {
                                recipient: checkoutRequest.recipient,
                                recipientType: checkoutRequest.recipientType || Nimiq.Account.Type.BASIC,
                                sender: checkoutRequest.sender,
                                forceSender: !!checkoutRequest.forceSender,
                                fee: checkoutRequest.fee || 0,
                                flags: checkoutRequest.flags,
                                validityDuration: !checkoutRequest.validityDuration ? TX_VALIDITY_WINDOW : Math.min(
                                    TX_VALIDITY_WINDOW,
                                    Math.max(
                                        TX_MIN_VALIDITY_DURATION,
                                        checkoutRequest.validityDuration,
                                    ),
                                ),
                            },
                        })],
                    } as ParsedCheckoutRequest;
                } else {
                    if (checkoutRequest.version === 2) {
                        if (!checkoutRequest.paymentOptions.some((option) => option.currency === Currency.NIM)) {
                            throw new Error('CheckoutRequest must provide a NIM paymentOption.');
                        }

                        if (!checkoutRequest.shopLogoUrl
                            || new URL(checkoutRequest.shopLogoUrl).origin !== state.origin) {
                            throw new Error(
                                'shopLogoUrl must have same origin as caller website. Image at ' +
                                checkoutRequest.shopLogoUrl +
                                ' is not on caller origin ' +
                                state.origin);
                        }

                        if (!CurrencyCode.codes().includes(checkoutRequest.fiatCurrency)) {
                            throw new Error(`FiatCurrency ${checkoutRequest.fiatCurrency} not in ISO 4217`);
                        }

                        if (!checkoutRequest.fiatAmount || checkoutRequest.fiatAmount <= 0) {
                            throw new Error('fiatAmount must be a positive non-zero number');
                        }

                        if (!checkoutRequest.callbackUrl) {
                            if (!checkoutRequest.paymentOptions.every(
                                    (option) => !!option.protocolSpecific.recipient,
                                )) {
                                throw new Error('A callbackUrl or all recipients must be provided');
                            }
                        } else {
                            if (new URL(checkoutRequest.callbackUrl).origin !== state.origin) {
                                throw new Error('callBackUrl must have the same origin as caller Website. ' +
                                    checkoutRequest.callbackUrl +
                                    ' is not on caller origin ' +
                                    state.origin);
                            }
                            if (!checkoutRequest.csrf) {
                                throw new Error('A CSRF token must be provided alongside the callbackUrl.');
                            }
                        }

                        if (checkoutRequest.time && typeof checkoutRequest.time !== 'number') {
                            throw new Error('time must be a number');
                        }

                        const currencies: Set<Currency> = new Set<Currency>();

                        return {
                            kind: RequestType.CHECKOUT,
                            appName: checkoutRequest.appName,
                            shopLogoUrl: checkoutRequest.shopLogoUrl,
                            callbackUrl: checkoutRequest.callbackUrl,
                            csrf: checkoutRequest.csrf,
                            data: typeof checkoutRequest.extraData === 'string'
                                ? Utf8Tools.stringToUtf8ByteArray(checkoutRequest.extraData)
                                : checkoutRequest.extraData || new Uint8Array(0),
                            time: !checkoutRequest.time
                                ? + new Date()
                                : isMilliseconds(checkoutRequest.time)
                                    ? checkoutRequest.time
                                    : checkoutRequest.time * 1000,
                            fiatCurrency: CurrencyCode.code(checkoutRequest.fiatCurrency),
                            fiatAmount: checkoutRequest.fiatAmount,
                            paymentOptions: checkoutRequest.paymentOptions.map((option) => {
                                if (!option.amount) {
                                    throw new Error('Each paymentOption must provide an amount.');
                                }
                                if (!option.expires) {
                                    throw new Error('Each paymentOption must provide its expiration time');
                                }

                                if (currencies.has(option.currency)) {
                                    throw new Error('Each Currency can only have one paymentOption');
                                } else {
                                    currencies.add(option.currency);
                                }
                                switch (option.type) {
                                    case PaymentMethod.DIRECT:
                                        switch (option.currency) {
                                            case Currency.NIM:
                                                return new ParsedNimiqDirectPaymentOptions(option);
                                            case Currency.ETH:
                                                return new ParsedEtherDirectPaymentOptions(option);
                                            case Currency.BTC:
                                                return new ParsedBitcoinDirectPaymentOptions(option);
                                            default:
                                                throw new Error(`Currency ${(option as any).currency} not supported`);
                                        }
                                    default:
                                        throw new Error(`PaymentMethod not supported`);
                                }
                        }),
                        } as ParsedCheckoutRequest;
                    }
                }
            case RequestType.ONBOARD:
                const onboardRequest = request as OnboardRequest;
                return {
                    kind: requestType,
                    appName: onboardRequest.appName,
                    disableBack: !!onboardRequest.disableBack,
                } as ParsedOnboardRequest;
            case RequestType.SIGNUP:
            case RequestType.CHOOSE_ADDRESS:
            case RequestType.LOGIN:
            case RequestType.MIGRATE:
                return {
                    kind: requestType,
                    appName: request.appName,
                } as ParsedBasicRequest;
            case RequestType.CHANGE_PASSWORD:
            case RequestType.LOGOUT:
            case RequestType.ADD_ADDRESS:
                const simpleRequest = request as SimpleRequest;

                if (!simpleRequest.accountId) throw new Error('accountId is required');

                return {
                    kind: requestType,
                    appName: simpleRequest.appName,
                    walletId: simpleRequest.accountId,
                } as ParsedSimpleRequest;
            case RequestType.EXPORT:
                const exportRequest = request as ExportRequest;

                if (!exportRequest.accountId) throw new Error('accountId is required');

                return {
                    kind: RequestType.EXPORT,
                    appName: exportRequest.appName,
                    walletId: exportRequest.accountId,
                    fileOnly: exportRequest.fileOnly,
                    wordsOnly: exportRequest.wordsOnly,
                } as ParsedExportRequest;
            case RequestType.RENAME:
                const renameRequest = request as RenameRequest;

                if (!renameRequest.accountId) throw new Error('accountId is required');

                return {
                    kind: RequestType.RENAME,
                    appName: renameRequest.appName,
                    walletId: renameRequest.accountId,
                    address: renameRequest.address,
                } as ParsedRenameRequest;
            case RequestType.SIGN_MESSAGE:
                const signMessageRequest = request as SignMessageRequest;
                if (typeof signMessageRequest.message !== 'string'
                    && !(signMessageRequest.message instanceof Uint8Array)) {
                    throw new Error('message must be a string or Uint8Array');
                }
                return {
                    kind: RequestType.SIGN_MESSAGE,
                    appName: signMessageRequest.appName,
                    signer: signMessageRequest.signer
                            ? Nimiq.Address.fromUserFriendlyAddress(signMessageRequest.signer)
                            : undefined,
                    message: signMessageRequest.message,
                } as ParsedSignMessageRequest;
            default:
                return null;
        }
    }

    public static raw(request: ParsedRpcRequest)
        : RpcRequest | ExtendedRpcRequest | null {
        switch (request.kind) {
            case RequestType.SIGN_TRANSACTION:
                const signTransactionRequest = request as ParsedSignTransactionRequest;
                return {
                    appName: signTransactionRequest.appName,
                    sender: signTransactionRequest.sender.toUserFriendlyAddress(),
                    recipient: signTransactionRequest.recipient.toUserFriendlyAddress(),
                    recipientType: signTransactionRequest.recipientType,
                    value: signTransactionRequest.value,
                    fee: signTransactionRequest.fee,
                    extraData: signTransactionRequest.data,
                    flags: signTransactionRequest.flags,
                    validityStartHeight: signTransactionRequest.validityStartHeight,
                } as SignTransactionRequest;
            case RequestType.CHECKOUT:
                const checkoutRequest = request as ParsedCheckoutRequest;
                return {
                    appName: checkoutRequest.appName,
                    version: 2,
                    shopLogoUrl: checkoutRequest.shopLogoUrl,
                    extraData: checkoutRequest.data,
                    callbackUrl: checkoutRequest.callbackUrl,
                    csrf: checkoutRequest.csrf,
                    time: checkoutRequest.time,
                    fiatAmount: checkoutRequest.fiatAmount ? checkoutRequest.fiatAmount : undefined,
                    fiatCurrency: checkoutRequest.fiatCurrency ? checkoutRequest.fiatCurrency.code : undefined,
                    paymentOptions: checkoutRequest.paymentOptions.map((option) => {
                        switch (option.type) {
                            case PaymentMethod.DIRECT:
                                return option.raw();
                            default:
                                throw new Error('paymentOption.type not supported');
                        }
                    }),
                } as ExtendedCheckoutRequest;
            case RequestType.ONBOARD:
                const onboardRequest = request as ParsedOnboardRequest;
                return {
                    appName: onboardRequest.appName,
                    disableBack: onboardRequest.disableBack,
                } as OnboardRequest;
            case RequestType.SIGNUP:
            case RequestType.CHOOSE_ADDRESS:
            case RequestType.LOGIN:
            case RequestType.MIGRATE:
                return {
                    appName: request.appName,
                } as BasicRequest;
            case RequestType.CHANGE_PASSWORD:
            case RequestType.LOGOUT:
            case RequestType.ADD_ADDRESS:
                const simpleRequest = request as ParsedSimpleRequest;
                return {
                    appName: simpleRequest.appName,
                    accountId: simpleRequest.walletId,
                } as SimpleRequest;
            case RequestType.EXPORT:
                const exportRequest = request as ParsedExportRequest;
                return {
                    appName: exportRequest.appName,
                    accountId: exportRequest.walletId,
                    fileOnly: exportRequest.fileOnly,
                    wordsOnly: exportRequest.wordsOnly,
                } as ExportRequest;
            case RequestType.RENAME:
                const renameRequest = request as ParsedRenameRequest;
                return {
                    appName: renameRequest.appName,
                    accountId: renameRequest.walletId,
                    address: renameRequest.address,
                } as RenameRequest;
            case RequestType.SIGN_MESSAGE:
                const signMessageRequest = request as ParsedSignMessageRequest;
                return {
                    appName: signMessageRequest.appName,
                    signer: signMessageRequest.signer ? signMessageRequest.signer.toUserFriendlyAddress() : undefined,
                    message: signMessageRequest.message,
                } as SignMessageRequest;
            default:
                return null;
        }
    }
}
