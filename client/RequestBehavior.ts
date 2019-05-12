import { RequestType } from '../src/lib/RequestTypes';
import { PostMessageRpcClient, RedirectRpcClient } from '@nimiq/rpc';
import { ResultByRequestType } from '@/lib/PublicRequestTypes';

export class RequestBehavior {
    public static getAllowedOrigin(endpoint: string) {
        const url = new URL(endpoint);
        return url.origin;
    }

    private readonly _type: BehaviorType;

    constructor(type: BehaviorType) {
        this._type = type;
    }

    public async request<T extends RequestType, B extends RequestBehavior>(
        endpoint: string,
        command: T,
        args: any[],
    ): Promise<B extends RedirectRequestBehavior ? void : ResultByRequestType<T>> {
        throw new Error('Not implemented');
    }

    public get type() {
        return this._type;
    }
}

export enum BehaviorType {
    REDIRECT,
    POPUP,
    IFRAME,
}

export class RedirectRequestBehavior extends RequestBehavior {
    public static withLocalState(localState: any) {
        return new RedirectRequestBehavior(undefined, localState);
    }

    private readonly _returnUrl: string;
    private readonly _localState: any;

    constructor(returnUrl?: string, localState?: any) {
        super(BehaviorType.REDIRECT);
        const location = window.location;
        this._returnUrl = returnUrl || `${location.origin}${location.pathname}`;
        this._localState = localState || {};

        // Reject local state with reserved property.
        if (typeof this._localState.__command !== 'undefined') {
            throw new Error('Invalid localState: Property \'__command\' is reserved');
        }
    }

    public async request<T extends RequestType, B extends RedirectRequestBehavior>(
        endpoint: string,
        command: T,
        args: any[],
    ): Promise<void> {
        const origin = RequestBehavior.getAllowedOrigin(endpoint);

        const client = new RedirectRpcClient(endpoint, origin);
        await client.init();

        const state: object = Object.assign({}, this._localState, { __command: command });
        client.callAndSaveLocalState(this._returnUrl, state, command, true, ...args);
    }
}

export class PopupRequestBehavior extends RequestBehavior {
    private static DEFAULT_OPTIONS: string = '';
    private _options: string;

    constructor(options = PopupRequestBehavior.DEFAULT_OPTIONS) {
        super(BehaviorType.POPUP);
        this._options = options;
    }

    public async request<T extends RequestType, B extends PopupRequestBehavior>(
        endpoint: string,
        command: T,
        args: any[],
    ): Promise<ResultByRequestType<T>> {
        const origin = RequestBehavior.getAllowedOrigin(endpoint);

        const popup = this.createPopup(endpoint);
        const client = new PostMessageRpcClient(popup, origin);
        await client.init();

        try {
            return await client.call(command, ...args);
        } catch (e) {
            throw e;
        } finally {
            client.close();
            popup.close();
        }
    }

    public createPopup(url: string) {
        const popup = window.open(url, 'NimiqAccounts', this._options);
        if (!popup) {
            throw new Error('Failed to open popup');
        }
        return popup;
    }
}

export class IFrameRequestBehavior extends RequestBehavior {
    private static IFRAME_PATH_SUFFIX = '/iframe.html';

    private _iframe: HTMLIFrameElement | null;
    private _client: PostMessageRpcClient | null;

    constructor() {
        super(BehaviorType.IFRAME);
        this._iframe = null;
        this._client = null;
    }

    public async request(endpoint: string, command: RequestType, args: any[]): Promise<any> {
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
            this._client = new PostMessageRpcClient(this._iframe.contentWindow, origin);
            await this._client.init();
        }

        return await this._client.call(command, ...args);
    }

    public async createIFrame(endpoint: string): Promise<HTMLIFrameElement> {
        return new Promise((resolve, reject) => {
            const $iframe = document.createElement('iframe');
            $iframe.name = 'NimiqAccountsIFrame';
            $iframe.style.display = 'none';
            document.body.appendChild($iframe);
            $iframe.src = `${endpoint}${IFrameRequestBehavior.IFRAME_PATH_SUFFIX}`;
            $iframe.onload = () => resolve($iframe);
            $iframe.onerror = reject;
        }) as Promise<HTMLIFrameElement>;
    }
}
