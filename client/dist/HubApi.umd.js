(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('@nimiq/rpc'), require('@nimiq/utils')) :
    typeof define === 'function' && define.amd ? define(['@nimiq/rpc', '@nimiq/utils'], factory) :
    (global = global || self, global.HubApi = factory(global.rpc, global.utils));
}(this, function (rpc, utils) { 'use strict';

    var de = {
    	"popup-overlay": "Ein Popup hat sich geöffnet,\nklicke hier, um zurück zum Popup zu kommen."
    };

    var en = {
    	"popup-overlay": "A popup has been opened,\nclick anywhere to bring it back to the front."
    };

    var es = {
    	"popup-overlay": "Se ha abierto una ventana emergente.\nHaga click en cualquier lugar para traer la ventana al primer plano."
    };

    var fil = {
    	"popup-overlay": "Nag-bukas ang isang pop-up.\nMaaring pindutin kahit saan para ibalik ito sa harap."
    };

    var fr = {
    	"popup-overlay": "Une popup a été ouverte,\ncliquez n'importe où pour la ramener au premier plan."
    };

    var nl = {
    	"popup-overlay": "Er is een pop-up geopend,\nklik op het scherm om het weer naar voren te brengen."
    };

    var pl = {
    	"popup-overlay": "Pojawiło się wyskakujące okno.\nAby je zobaczyć, kliknij w dowolnym miejscu."
    };

    var pt = {
    	"popup-overlay": "Um popup foi aberto,\nclique em qualquer lado para o trazer para a frente."
    };

    var ru = {
    	"popup-overlay": "Открыто всплывающее окно.\nНажмите где-нибудь, чтобы вернуть его на передний план."
    };

    var tr = {
    	"popup-overlay": "Bir popup penceresi açıldı,\nöne çekmek için herhangi bir yere tıkla. "
    };

    var uk = {
    	"popup-overlay": "Відкрито випадаюче вікно.\nклацніть будь-де щоб перейти до ньго."
    };

    var zh = {
    	"popup-overlay": "弹出窗口已打开，\n单击任意位置即可回到上一页"
    };

    // Import the languages you want to support. Note that the language files are not lazy loaded on purpose, as they are
    const translations = { de, en, es, fil, fr, nl, pl, pt, ru, tr, uk, zh };
    function translate(id, language) {
        if (!language) {
            // Note that third party apps won't have access to the language cookie and will use a fallback language.
            const langMatch = document.cookie.match(/(^| )lang=([^;]+)/);
            language = (langMatch && langMatch[2]) || navigator.language.split('-')[0];
        }
        return (translations[language] || en)[id] || en[id];
    }

    class RequestBehavior {
        constructor(type) {
            this._type = type;
        }
        static getAllowedOrigin(endpoint) {
            const url = new URL(endpoint);
            return url.origin;
        }
        async request(endpoint, command, args) {
            throw new Error('Not implemented');
        }
    }
    var BehaviorType;
    (function (BehaviorType) {
        BehaviorType[BehaviorType["REDIRECT"] = 0] = "REDIRECT";
        BehaviorType[BehaviorType["POPUP"] = 1] = "POPUP";
        BehaviorType[BehaviorType["IFRAME"] = 2] = "IFRAME";
    })(BehaviorType || (BehaviorType = {}));
    class RedirectRequestBehavior extends RequestBehavior {
        constructor(returnUrl, localState) {
            super(BehaviorType.REDIRECT);
            const location = window.location;
            this._returnUrl = returnUrl || `${location.origin}${location.pathname}`;
            this._localState = localState || {};
            // Reject local state with reserved property.
            if (typeof this._localState.__command !== 'undefined') {
                throw new Error('Invalid localState: Property \'__command\' is reserved');
            }
        }
        static withLocalState(localState) {
            return new RedirectRequestBehavior(undefined, localState);
        }
        async request(endpoint, command, args) {
            const origin = RequestBehavior.getAllowedOrigin(endpoint);
            const client = new rpc.RedirectRpcClient(endpoint, origin);
            await client.init();
            const state = Object.assign({}, this._localState, { __command: command });
            client.callAndSaveLocalState(this._returnUrl, state, command, true, ...(await Promise.all(args)));
        }
    }
    class PopupRequestBehavior extends RequestBehavior {
        constructor(popupFeatures = PopupRequestBehavior.DEFAULT_FEATURES, options) {
            super(BehaviorType.POPUP);
            this.shouldRetryRequest = false;
            this._popupFeatures = popupFeatures;
            this._options = {
                ...PopupRequestBehavior.DEFAULT_OPTIONS,
                ...options,
            };
        }
        async request(endpoint, command, args) {
            const origin = RequestBehavior.getAllowedOrigin(endpoint);
            // Add page overlay
            const $overlay = this.appendOverlay();
            do {
                this.shouldRetryRequest = false;
                try {
                    this.popup = this.createPopup(endpoint);
                    this.client = new rpc.PostMessageRpcClient(this.popup, origin);
                    await this.client.init();
                    return await this.client.call(command, ...(await Promise.all(args)));
                }
                catch (e) {
                    if (!this.shouldRetryRequest)
                        throw e;
                }
                finally {
                    if (!this.shouldRetryRequest) {
                        // Remove page overlay
                        this.removeOverlay($overlay);
                        if (this.client)
                            this.client.close();
                        if (this.popup)
                            this.popup.close();
                    }
                }
            } while (this.shouldRetryRequest);
            // the code below should never be executed, unless unexpected things happened
            if (this.popup)
                this.popup.close();
            if (this.client)
                this.client.close();
            if ($overlay)
                this.removeOverlay($overlay);
            throw new Error('Unexpected error occurred');
        }
        createPopup(url) {
            const popup = window.open(url, 'NimiqAccounts', this._popupFeatures);
            if (!popup) {
                throw new Error('Failed to open popup');
            }
            return popup;
        }
        appendOverlay() {
            if (!this._options.overlay)
                return null;
            // Define DOM-method abstractions to allow better minification
            const createElement = document.createElement.bind(document);
            const appendChild = (node, child) => node.appendChild(child);
            // Overlay background
            const overlay = createElement('div');
            overlay.id = 'nimiq-hub-overlay';
            const overlayStyle = overlay.style;
            overlayStyle.position = 'fixed';
            overlayStyle.top = '0';
            overlayStyle.right = '0';
            overlayStyle.bottom = '0';
            overlayStyle.left = '0';
            overlayStyle.background = 'rgba(31, 35, 72, 0.8)';
            overlayStyle.display = 'flex';
            overlayStyle.flexDirection = 'column';
            overlayStyle.alignItems = 'center';
            overlayStyle.justifyContent = 'space-between';
            overlayStyle.cursor = 'pointer';
            overlayStyle.color = 'white';
            overlayStyle.textAlign = 'center';
            overlayStyle.opacity = '0';
            overlayStyle.transition = 'opacity 0.6s ease';
            overlayStyle.zIndex = '99999';
            overlay.addEventListener('click', () => {
                if (utils.BrowserDetection.isIOS()) {
                    this.shouldRetryRequest = true;
                    if (this.popup)
                        this.popup.close();
                    if (this.client)
                        this.client.close();
                }
                else {
                    if (this.popup)
                        this.popup.focus();
                }
            });
            // Top flex spacer
            appendChild(overlay, createElement('div'));
            // Explainer text
            const text = createElement('div');
            text.textContent = translate('popup-overlay');
            const textStyle = text.style;
            textStyle.padding = '20px';
            // tslint:disable-next-line max-line-length
            textStyle.fontFamily = 'Muli, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif';
            textStyle.fontSize = '24px';
            textStyle.fontWeight = '600';
            textStyle.lineHeight = '40px';
            textStyle.whiteSpace = 'pre-line';
            appendChild(overlay, text);
            // Logo
            const logo = createElement('img');
            // tslint:disable-next-line max-line-length
            logo.src = 'data:image/svg+xml,<svg width="135" height="32" viewBox="0 0 135 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M35.6 14.5l-7.5-13A3 3 0 0025.5 0h-15a3 3 0 00-2.6 1.5l-7.5 13a3 3 0 000 3l7.5 13a3 3 0 002.6 1.5h15a3 3 0 002.6-1.5l7.5-13a3 3 0 000-3z" fill="url(%23hub-overlay-nimiq-logo)"/><path d="M62.25 6.5h3.26v19H63L52.75 12.25V25.5H49.5v-19H52l10.25 13.25V6.5zM72 25.5v-19h3.5v19H72zM97.75 6.5h2.75v19h-3V13.75L92.37 25.5h-2.25L85 13.75V25.5h-3v-19h2.75l6.5 14.88 6.5-14.88zM107 25.5v-19h3.5v19H107zM133.88 21.17a7.91 7.91 0 01-4.01 3.8c.16.38.94 1.44 1.52 2.05.59.6 1.2 1.23 1.98 1.86L131 30.75a15.91 15.91 0 01-4.45-5.02l-.8.02c-1.94 0-3.55-.4-4.95-1.18a7.79 7.79 0 01-3.2-3.4 11.68 11.68 0 01-1.1-5.17c0-2.03.37-3.69 1.12-5.17a7.9 7.9 0 013.2-3.4 9.8 9.8 0 014.93-1.18c1.9 0 3.55.4 4.94 1.18a7.79 7.79 0 013.2 3.4 11.23 11.23 0 011.1 5.17c0 2.03-.44 3.83-1.11 5.17zm-12.37.01a5.21 5.21 0 004.24 1.82 5.2 5.2 0 004.23-1.82c1.01-1.21 1.52-2.92 1.52-5.18 0-2.24-.5-4-1.52-5.2a5.23 5.23 0 00-4.23-1.8c-1.82 0-3.23.6-4.24 1.79-1 1.2-1.51 2.95-1.51 5.21s.5 3.97 1.51 5.18z" fill="white"/><defs><radialGradient id="hub-overlay-nimiq-logo" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-35.9969 0 0 -32 36 32)"><stop stop-color="%23EC991C"/><stop offset="1" stop-color="%23E9B213"/></radialGradient></defs></svg>';
            logo.style.marginBottom = '56px';
            appendChild(overlay, logo);
            // Close button
            const button = createElement('div');
            const buttonStyle = button.style;
            button.innerHTML = '&times;';
            buttonStyle.position = 'absolute';
            buttonStyle.top = '8px';
            buttonStyle.right = '8px';
            buttonStyle.fontSize = '24px';
            buttonStyle.lineHeight = '32px';
            buttonStyle.fontWeight = '600';
            buttonStyle.width = '32px';
            buttonStyle.height = '32px';
            buttonStyle.opacity = '0.8';
            button.addEventListener('click', (event) => {
                if (this.popup)
                    this.popup.close();
                event.stopPropagation();
            });
            appendChild(overlay, button);
            // The 100ms delay is not just because the DOM element needs to be rendered before it
            // can be animated, but also because it actually feels better when there is a short
            // delay between the opening popup and the background fading.
            setTimeout(() => overlay.style.opacity = '1', 100);
            return appendChild(document.body, overlay);
        }
        removeOverlay($overlay) {
            if (!$overlay)
                return;
            $overlay.style.opacity = '0';
            setTimeout(() => document.body.removeChild($overlay), 400);
        }
    }
    PopupRequestBehavior.DEFAULT_FEATURES = '';
    PopupRequestBehavior.DEFAULT_OPTIONS = {
        overlay: true,
    };
    class IFrameRequestBehavior extends RequestBehavior {
        constructor() {
            super(BehaviorType.IFRAME);
            this._iframe = null;
            this._client = null;
        }
        async request(endpoint, command, args) {
            if (this._iframe && this._iframe.src !== `${endpoint}${IFrameRequestBehavior.IFRAME_PATH_SUFFIX}`) {
                throw new Error('Hub iframe is already opened with another endpoint');
            }
            const origin = RequestBehavior.getAllowedOrigin(endpoint);
            if (!this._iframe) {
                this._iframe = await this.createIFrame(endpoint);
            }
            if (!this._iframe.contentWindow) {
                throw new Error(`IFrame contentWindow is ${typeof this._iframe.contentWindow}`);
            }
            if (!this._client) {
                this._client = new rpc.PostMessageRpcClient(this._iframe.contentWindow, origin);
                await this._client.init();
            }
            return await this._client.call(command, ...(await Promise.all(args)));
        }
        async createIFrame(endpoint) {
            return new Promise((resolve, reject) => {
                const $iframe = document.createElement('iframe');
                $iframe.name = 'NimiqAccountsIFrame';
                $iframe.style.display = 'none';
                document.body.appendChild($iframe);
                $iframe.src = `${endpoint}${IFrameRequestBehavior.IFRAME_PATH_SUFFIX}`;
                $iframe.onload = () => resolve($iframe);
                $iframe.onerror = reject;
            });
        }
    }
    IFrameRequestBehavior.IFRAME_PATH_SUFFIX = '/iframe.html';

    var RequestType;
    (function (RequestType) {
        RequestType["LIST"] = "list";
        RequestType["LIST_CASHLINKS"] = "list-cashlinks";
        RequestType["MIGRATE"] = "migrate";
        RequestType["CHECKOUT"] = "checkout";
        RequestType["SIGN_MESSAGE"] = "sign-message";
        RequestType["SIGN_TRANSACTION"] = "sign-transaction";
        RequestType["ONBOARD"] = "onboard";
        RequestType["SIGNUP"] = "signup";
        RequestType["LOGIN"] = "login";
        RequestType["EXPORT"] = "export";
        RequestType["CHANGE_PASSWORD"] = "change-password";
        RequestType["LOGOUT"] = "logout";
        RequestType["ADD_ADDRESS"] = "add-address";
        RequestType["RENAME"] = "rename";
        RequestType["ADD_VESTING_CONTRACT"] = "add-vesting-contract";
        RequestType["CHOOSE_ADDRESS"] = "choose-address";
        RequestType["CREATE_CASHLINK"] = "create-cashlink";
        RequestType["MANAGE_CASHLINK"] = "manage-cashlink";
        RequestType["SIGN_BTC_TRANSACTION"] = "sign-btc-transaction";
        RequestType["ADD_BTC_ADDRESSES"] = "add-btc-addresses";
        RequestType["SIGN_POLYGON_TRANSACTION"] = "sign-polygon-transaction";
        RequestType["ACTIVATE_BITCOIN"] = "activate-bitcoin";
        RequestType["ACTIVATE_POLYGON"] = "activate-polygon";
        RequestType["SETUP_SWAP"] = "setup-swap";
        RequestType["REFUND_SWAP"] = "refund-swap";
    })(RequestType || (RequestType = {}));
    var AccountType;
    (function (AccountType) {
        AccountType[AccountType["LEGACY"] = 1] = "LEGACY";
        AccountType[AccountType["BIP39"] = 2] = "BIP39";
        AccountType[AccountType["LEDGER"] = 3] = "LEDGER";
    })(AccountType || (AccountType = {}));
    var PaymentType;
    (function (PaymentType) {
        PaymentType[PaymentType["DIRECT"] = 0] = "DIRECT";
        PaymentType[PaymentType["OASIS"] = 1] = "OASIS";
    })(PaymentType || (PaymentType = {}));
    var Currency;
    (function (Currency) {
        Currency["NIM"] = "nim";
        Currency["BTC"] = "btc";
        Currency["ETH"] = "eth";
    })(Currency || (Currency = {}));
    var PaymentState;
    (function (PaymentState) {
        PaymentState["NOT_FOUND"] = "NOT_FOUND";
        PaymentState["PAID"] = "PAID";
        PaymentState["UNDERPAID"] = "UNDERPAID";
        PaymentState["OVERPAID"] = "OVERPAID";
    })(PaymentState || (PaymentState = {}));
    var CashlinkState;
    (function (CashlinkState) {
        CashlinkState[CashlinkState["UNKNOWN"] = -1] = "UNKNOWN";
        CashlinkState[CashlinkState["UNCHARGED"] = 0] = "UNCHARGED";
        CashlinkState[CashlinkState["CHARGING"] = 1] = "CHARGING";
        CashlinkState[CashlinkState["UNCLAIMED"] = 2] = "UNCLAIMED";
        CashlinkState[CashlinkState["CLAIMING"] = 3] = "CLAIMING";
        CashlinkState[CashlinkState["CLAIMED"] = 4] = "CLAIMED";
    })(CashlinkState || (CashlinkState = {}));
    var CashlinkTheme;
    (function (CashlinkTheme) {
        CashlinkTheme[CashlinkTheme["UNSPECIFIED"] = 0] = "UNSPECIFIED";
        CashlinkTheme[CashlinkTheme["STANDARD"] = 1] = "STANDARD";
        CashlinkTheme[CashlinkTheme["CHRISTMAS"] = 2] = "CHRISTMAS";
        CashlinkTheme[CashlinkTheme["LUNAR_NEW_YEAR"] = 3] = "LUNAR_NEW_YEAR";
        CashlinkTheme[CashlinkTheme["EASTER"] = 4] = "EASTER";
        CashlinkTheme[CashlinkTheme["GENERIC"] = 5] = "GENERIC";
        CashlinkTheme[CashlinkTheme["BIRTHDAY"] = 6] = "BIRTHDAY";
        // Temporary themes that might be retracted in the future should be listed counting down from 255
    })(CashlinkTheme || (CashlinkTheme = {}));

    class HubApi {
        constructor(endpoint = HubApi.DEFAULT_ENDPOINT, defaultBehavior) {
            this._endpoint = endpoint;
            this._defaultBehavior = defaultBehavior || new PopupRequestBehavior(`left=${window.innerWidth / 2 - 400},top=75,width=800,height=850,location=yes,dependent=yes`);
            // If no default behavior specified, use a default behavior with increased window height for checkout.
            this._checkoutDefaultBehavior = defaultBehavior || new PopupRequestBehavior(`left=${window.innerWidth / 2 - 400},top=50,width=800,height=895,location=yes,dependent=yes`);
            this._iframeBehavior = new IFrameRequestBehavior();
            // Check for RPC results in the URL
            this._redirectClient = new rpc.RedirectRpcClient('', RequestBehavior.getAllowedOrigin(this._endpoint));
        }
        /** @deprecated */
        static get PaymentMethod() {
            console.warn('PaymentMethod has been renamed to PaymentType. Access via HubApi.PaymentMethod will soon '
                + 'get disabled. Use HubApi.PaymentType instead.');
            return PaymentType;
        }
        static get DEFAULT_ENDPOINT() {
            const mainDomainMatch = location.hostname.match(/(?:[^.]+\.[^.]+|localhost)$/);
            const mainDomain = mainDomainMatch ? mainDomainMatch[0] : location.hostname;
            switch (mainDomain) {
                case 'nimiq.com':
                case 'nimiq-testnet.com':
                    return `https://hub.${mainDomain}`;
                case 'bs-local.com':
                    // BrowserStack's localhost tunnel bs-local.com for iOS debugging in BrowserStack, see
                    // https://www.browserstack.com/docs/live/local-testing/ios-troubleshooting-guide
                    return `${window.location.protocol}//bs-local.com:8080`;
                default:
                    return 'http://localhost:8080';
            }
        }
        checkRedirectResponse() {
            return this._redirectClient.init();
        }
        on(command, resolve, reject) {
            this._redirectClient.onResponse(command, 
            // State is always an object containing at least the __command property
            (result, rpcId, state) => resolve(result, state), (error, rpcId, state) => {
                if (!reject)
                    return;
                reject(error, state);
            });
        }
        /**
         * Public API
         */
        createCashlink(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.CREATE_CASHLINK, [request]);
        }
        manageCashlink(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.MANAGE_CASHLINK, [request]);
        }
        checkout(request, requestBehavior = this._checkoutDefaultBehavior) {
            return this._request(requestBehavior, RequestType.CHECKOUT, [request]);
        }
        chooseAddress(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.CHOOSE_ADDRESS, [request]);
        }
        signTransaction(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.SIGN_TRANSACTION, [request]);
        }
        signMessage(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.SIGN_MESSAGE, [request]);
        }
        signBtcTransaction(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.SIGN_BTC_TRANSACTION, [request]);
        }
        signPolygonTransaction(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.SIGN_POLYGON_TRANSACTION, [request]);
        }
        setupSwap(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.SETUP_SWAP, [request]);
        }
        refundSwap(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.REFUND_SWAP, [request]);
        }
        /**
         * Account Management
         *
         * Only accessible from Nimiq domains.
         */
        onboard(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.ONBOARD, [request]);
        }
        signup(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.SIGNUP, [request]);
        }
        login(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.LOGIN, [request]);
        }
        logout(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.LOGOUT, [request]);
        }
        export(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.EXPORT, [request]);
        }
        changePassword(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.CHANGE_PASSWORD, [request]);
        }
        addAddress(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.ADD_ADDRESS, [request]);
        }
        rename(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.RENAME, [request]);
        }
        addVestingContract(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.ADD_VESTING_CONTRACT, [request]);
        }
        migrate(requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.MIGRATE, [{ appName: 'Account list' }]);
        }
        activateBitcoin(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.ACTIVATE_BITCOIN, [request]);
        }
        activatePolygon(request, requestBehavior = this._defaultBehavior) {
            return this._request(requestBehavior, RequestType.ACTIVATE_POLYGON, [request]);
        }
        /**
         * Only accessible in iframe from Nimiq domains.
         */
        list(requestBehavior = this._iframeBehavior) {
            return this._request(requestBehavior, RequestType.LIST, []);
        }
        cashlinks(requestBehavior = this._iframeBehavior) {
            return this._request(requestBehavior, RequestType.LIST_CASHLINKS, []);
        }
        addBtcAddresses(request, requestBehavior = this._iframeBehavior) {
            return this._request(requestBehavior, RequestType.ADD_BTC_ADDRESSES, [request]);
        }
        // END API
        /* PRIVATE METHODS */
        _request(behavior, command, args) {
            return behavior.request(this._endpoint, command, args);
        }
    }
    // Expose request behaviors and enum values. Not exporting them via regular exports to avoid that users of the umd
    // build have to use bundle['default'] to access the default export.
    // Additionally, the types of these are exported in the client's index.d.ts.
    HubApi.BehaviorType = BehaviorType;
    HubApi.RequestType = RequestType;
    HubApi.RedirectRequestBehavior = RedirectRequestBehavior;
    HubApi.PopupRequestBehavior = PopupRequestBehavior;
    HubApi.AccountType = AccountType;
    HubApi.CashlinkState = CashlinkState;
    HubApi.CashlinkTheme = CashlinkTheme;
    HubApi.Currency = Currency;
    HubApi.PaymentType = PaymentType;
    HubApi.PaymentState = PaymentState;
    HubApi.MSG_PREFIX = '\x16Nimiq Signed Message:\n';

    return HubApi;

}));
