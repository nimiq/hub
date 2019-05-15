import HubApi from '../../client/HubApi';
import * as KeyguardClient from '@nimiq/keyguard-client';

describe('HubApi', () => {
    it('exports the correct MSG_PREFIX', () => {
        expect(HubApi.MSG_PREFIX).toEqual(KeyguardClient.MSG_PREFIX);
    });
});
