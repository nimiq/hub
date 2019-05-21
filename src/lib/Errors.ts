import { Errors } from '@nimiq/keyguard-client';
export const HubErrors = {
    Types: {
        ...Errors.Types,
        VUE: 'Vue',
        HUB: 'Hub',
    },
    Messages: {
        ...Errors.Messages,
        ACCOUNT_NOT_FOUND: 'Account was not found',
    },
};

export class BaseError extends Error {
    constructor(type: string, messageOrError: string | Error | undefined) {
        if (messageOrError instanceof Error) {
            super(messageOrError.message);
            if (messageOrError.name === 'Error') {
                this.name = type;
            } else {
                this.name = messageOrError.name;
            }
            if (messageOrError.stack) {
                this.stack = messageOrError.stack;
            }
        } else {
            super(messageOrError || '');
            this.name = type;
        }
    }
}

export class InvalidRequestError extends BaseError {
    constructor(messageOrError: string | Error) {
        super(HubErrors.Types.INVALID_REQUEST, messageOrError);
    }
}

export class UnclassifiedError  extends BaseError {
    constructor(messageOrError: string | Error) {
        super(HubErrors.Types.UNCLASSIFIED, messageOrError);
    }
}

export class VueError extends BaseError {
    constructor(messageOrError: string | Error) {
        super(HubErrors.Types.VUE, messageOrError);
    }
}

export class HubError  extends BaseError {
    constructor(messageOrError: string | Error) {
        super(HubErrors.Types.HUB, messageOrError);
    }
}

export class AccountNotFoundError extends HubError {
    constructor() {
        super(HubErrors.Messages.ACCOUNT_NOT_FOUND);
    }
}
