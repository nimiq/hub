// Import @nimiq/core-web types from relative path within user's node_modules
/// <reference path="../../core-web/namespace.d.ts" />

export { default } from '../dist/src/client/HubApi';

// export public request types and RequestBehavior types for convenience of the HupApi user
export * from '../dist/src/src/lib/PublicRequestTypes';
export { PopupRequestBehavior, RedirectRequestBehavior } from '../dist/src/client/RequestBehavior';
