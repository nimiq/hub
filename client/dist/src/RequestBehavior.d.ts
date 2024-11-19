import { ResultByRequestType, RequestType } from './PublicRequestTypes';
export declare abstract class RequestBehavior<B extends BehaviorType> {
    static getAllowedOrigin(endpoint: string): string;
    private readonly _type;
    constructor(type: B);
    request<R extends RequestType>(endpoint: string, command: R, args: Iterable<PromiseLike<any> | any>): Promise<B extends BehaviorType.REDIRECT ? void : ResultByRequestType<R>>;
}
export declare enum BehaviorType {
    REDIRECT = 0,
    POPUP = 1,
    IFRAME = 2
}
export declare class RedirectRequestBehavior extends RequestBehavior<BehaviorType.REDIRECT> {
    static withLocalState(localState: any): RedirectRequestBehavior;
    private readonly _returnUrl;
    private readonly _localState;
    constructor(returnUrl?: string, localState?: any);
    request<R extends RequestType>(endpoint: string, command: R, args: Iterable<PromiseLike<any> | any>): Promise<void>;
}
export declare class PopupRequestBehavior extends RequestBehavior<BehaviorType.POPUP> {
    private static DEFAULT_FEATURES;
    private static DEFAULT_OPTIONS;
    private _popupFeatures;
    private _options;
    private shouldRetryRequest;
    private popup;
    private client;
    constructor(popupFeatures?: string, options?: typeof PopupRequestBehavior.DEFAULT_OPTIONS);
    request<R extends RequestType>(endpoint: string, command: R, args: Iterable<PromiseLike<any> | any>): Promise<ResultByRequestType<R>>;
    createPopup(url: string): Window;
    private appendOverlay;
    private removeOverlay;
}
export declare class IFrameRequestBehavior extends RequestBehavior<BehaviorType.IFRAME> {
    private static IFRAME_PATH_SUFFIX;
    private _iframe;
    private _client;
    constructor();
    request<R extends RequestType>(endpoint: string, command: R, args: Iterable<PromiseLike<any> | any>): Promise<ResultByRequestType<R>>;
    createIFrame(endpoint: string): Promise<HTMLIFrameElement>;
}
