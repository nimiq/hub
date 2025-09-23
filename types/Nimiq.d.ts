import type * as _Nimiq from '@nimiq/core/types/web';

export as namespace Nimiq;
export = _Nimiq;

declare global {
    const Nimiq: typeof _Nimiq;
}
