import { Errors } from '@nimiq/keyguard-client';

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
        super(Errors.Types.INVALID_REQUEST, messageOrError);
    }
}

export class CoreError  extends BaseError {
    constructor(messageOrError: string | Error) {
        super(Errors.Types.CORE, messageOrError);
    }
}

export class UnclassifiedError  extends BaseError {
    constructor(messageOrError: string | Error) {
        super(Errors.Types.UNCLASSIFIED, messageOrError);
    }
}

export class KeyguardError  extends BaseError {
    constructor(messageOrError: string | Error) {
        super(Errors.Types.KEYGUARD, messageOrError);
    }
}

export class AccountNotFoundError extends KeyguardError {
    constructor() {
        super(Errors.Messages.KEY_NOT_FOUND);
    }
}
