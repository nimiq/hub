import AccountsClient from '../../client/AccountsClient';
import * as KeyguardClient from '@nimiq/keyguard-client';

describe('AccountsClient', () => {
    it('exports the correct MSG_PREFIX', () => {
        expect(AccountsClient.MSG_PREFIX).toEqual(KeyguardClient.MSG_PREFIX);
    });
});
