import { setup } from './_setup';
import Cashlink from '@/lib/Cashlink';
import CashlinkInteractive, { CashlinkState } from '@/lib/CashlinkInteractive';
import { CashlinkCurrency } from '../../client/PublicRequestTypes';

setup();

const SECRET = new Uint8Array([
    70, 207, 252, 77, 192, 84, 237, 202, 3, 46, 88, 64, 101, 200, 131, 19, 212,
    105, 128, 49, 54, 99, 159, 166, 103, 196, 208, 178, 26, 244, 184, 234,
]);
const CASHLINK_ADDRESS = 'NQ73 822X Q55C EQ9N BV36 DD59 TMED X511 TQAY';
const RECIPIENT_ADDRESS = 'NQ94 DA1Q SVB4 61YN XEY6 2TVT F22G 0381 L284';
const VALUE = 1000;
const LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY = 'cashlink-last-claimed-multi-cashlinks';

type MockTransaction = { transactionHash: string, sender: string, recipient: string, state: string };

// State of the mocked network. Relayed transactions stay on their way until a test resolves or rejects them.
const mockNetwork = {
    balance: 0,
    includedTransactions: [] as MockTransaction[],
    relays: [] as Array<{ resolve: (isIncluded?: boolean) => void, reject: (error: Error) => void }>,
    transactionListeners: [] as Array<(transaction: MockTransaction) => void>,
    isUnreachable: false, // whether requests for balance and transactions fail
};

jest.mock('@/lib/NetworkClient', () => ({
    NetworkClient: {
        Instance: {
            init: async () => undefined,
            awaitConsensus: async () => undefined,
            innerClient: Promise.resolve({
                getHeadHeight: async () => 1000,
                addTransactionListener: async (listener: (transaction: MockTransaction) => void) =>
                    mockNetwork.transactionListeners.push(listener),
                removeListener: async () => undefined,
            }),
            getBalance: async (addresses: string[]) => {
                if (mockNetwork.isUnreachable) throw new Error('Network unreachable');
                return new Map(addresses.map((address): [string, number] => [address, mockNetwork.balance]));
            },
            getTransactionsByAddress: async () => {
                if (mockNetwork.isUnreachable) throw new Error('Network unreachable');
                return mockNetwork.includedTransactions;
            },
            getNetworkId: async () => 5,
            getHeight: async () => 1000,
            relayTransaction: (transaction: { sender: string, recipient: string, value: number, fee: number }) =>
                new Promise((resolve, reject) => mockNetwork.relays.push({
                    // Resolves like the network client does: with the transaction as included, after including it, or
                    // as new, if it did not get included while the network client waited for that.
                    resolve: (isIncluded = true) => {
                        const relayedTransaction = {
                            transactionHash: 'ab'.repeat(32),
                            sender: transaction.sender,
                            recipient: transaction.recipient,
                            value: transaction.value,
                            fee: transaction.fee,
                            state: isIncluded ? 'included' : 'new',
                        };
                        if (isIncluded) {
                            mockNetwork.balance -= transaction.value + transaction.fee;
                            mockNetwork.includedTransactions.push(relayedTransaction);
                        }
                        resolve(relayedTransaction);
                    },
                    reject,
                })),
        },
    },
}));

async function waitFor(condition: () => boolean) {
    while (!condition()) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}

async function createCashlink(balance: number, expectedState: CashlinkState = CashlinkState.UNCLAIMED) {
    mockNetwork.balance = balance;
    const cashlink = new CashlinkInteractive(new Cashlink(CashlinkCurrency.NIM, SECRET, CASHLINK_ADDRESS, VALUE));
    await waitFor(() => cashlink.state === expectedState);
    return cashlink;
}

function getLastClaimedMultiCashlinks(): string[] {
    return JSON.parse(window.localStorage[LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY] || '[]');
}

describe('CashlinkInteractive', () => {
    beforeEach(() => {
        window.localStorage.clear();
        mockNetwork.includedTransactions = [];
        mockNetwork.relays = [];
        mockNetwork.transactionListeners = [];
        mockNetwork.isUnreachable = false;
    });

    it('is blocked from being claimed again while its claiming transaction is on its way', async () => {
        const cashlink = await createCashlink(/* multi-claimable */ 5 * VALUE);

        const claim = cashlink.claim(RECIPIENT_ADDRESS);
        // The Cashlink is blocked right away, and not only once its state got detected anew.
        expect(cashlink.state).toBe(CashlinkState.CLAIMING);
        await expect(cashlink.claim(RECIPIENT_ADDRESS)).rejects.toThrow('Cashlink has already been claimed');

        await waitFor(() => mockNetwork.relays.length === 1);
        expect(cashlink.state).toBe(CashlinkState.CLAIMING);
        expect(getLastClaimedMultiCashlinks()).toEqual([CASHLINK_ADDRESS]);
        await expect(cashlink.claim(RECIPIENT_ADDRESS)).rejects.toThrow('Cashlink has already been claimed');

        // The same holds for a new instance, as it is created when the page gets reloaded.
        const reloadedCashlink = await createCashlink(5 * VALUE, CashlinkState.CLAIMED);
        await expect(reloadedCashlink.claim(RECIPIENT_ADDRESS)).rejects.toThrow('Cashlink has already been claimed');
        expect(mockNetwork.relays.length).toBe(1);

        mockNetwork.relays[0].resolve();
        const transaction = await claim;
        expect(transaction.sender).toBe(CASHLINK_ADDRESS);
        expect(transaction.recipient).toBe(RECIPIENT_ADDRESS);
        expect(transaction.value).toBe(VALUE);
    });

    it('can be claimed again if its claiming transaction could not be sent', async () => {
        const cashlink = await createCashlink(/* multi-claimable */ 5 * VALUE);

        const failingClaim = cashlink.claim(RECIPIENT_ADDRESS);
        await waitFor(() => mockNetwork.relays.length === 1);
        mockNetwork.relays[0].reject(new Error('Failed to relay'));
        await expect(failingClaim).rejects.toThrow('Failed to relay');
        expect(getLastClaimedMultiCashlinks()).toEqual([]);
        // The state gets detected anew after the failed claim.
        await waitFor(() => cashlink.state === CashlinkState.UNCLAIMED);

        const claim = cashlink.claim(RECIPIENT_ADDRESS);
        await waitFor(() => mockNetwork.relays.length === 2);
        mockNetwork.relays[1].resolve();
        await claim;
        expect(getLastClaimedMultiCashlinks()).toEqual([CASHLINK_ADDRESS]);
    });

    it('stays in claiming state until its claiming transaction got included', async () => {
        const cashlink = await createCashlink(/* single-claimable */ VALUE);
        // Make the recipient known as an address of the user, such that the claim is recognized as the user's.
        cashlink.setUserWallets([{
            accounts: new Map([[RECIPIENT_ADDRESS, {
                address: Nimiq.Address.fromUserFriendlyAddress(RECIPIENT_ADDRESS),
            }]]),
            contracts: [],
        }] as any);

        const claim = cashlink.claim(RECIPIENT_ADDRESS);
        await waitFor(() => mockNetwork.relays.length === 1);
        // Detecting the state anew while the claim is in progress does not change the state.
        await cashlink.detectState();
        expect(cashlink.state).toBe(CashlinkState.CLAIMING);

        mockNetwork.relays[0].resolve();
        await claim;
        // After the claim, the state gets detected anew and follows from what is known from the network again.
        await waitFor(() => cashlink.state === CashlinkState.CLAIMED);
    });

    it('is not remembered as claimed if it can only be claimed once', async () => {
        const cashlink = await createCashlink(/* single-claimable */ VALUE);

        const claim = cashlink.claim(RECIPIENT_ADDRESS);
        await waitFor(() => mockNetwork.relays.length === 1);
        expect(cashlink.state).toBe(CashlinkState.CLAIMING);
        expect(getLastClaimedMultiCashlinks()).toEqual([]);

        mockNetwork.relays[0].resolve();
        await claim;
        expect(getLastClaimedMultiCashlinks()).toEqual([]);
    });

    it('returns its claiming transaction as confirmed only if the network included it', async () => {
        const unconfirmedCashlink = await createCashlink(/* single-claimable */ VALUE);
        const unconfirmedClaim = unconfirmedCashlink.claim(RECIPIENT_ADDRESS);
        await waitFor(() => mockNetwork.relays.length === 1);
        mockNetwork.relays[0].resolve(/* isIncluded */ false);
        expect((await unconfirmedClaim).state).toBe('pending');

        const confirmedCashlink = await createCashlink(/* single-claimable */ VALUE);
        const confirmedClaim = confirmedCashlink.claim(RECIPIENT_ADDRESS);
        await waitFor(() => mockNetwork.relays.length === 2);
        mockNetwork.relays[1].resolve();
        expect((await confirmedClaim).state).toBe('confirmed');
    });

    it('reports if its balance and state could not be updated, until an update succeeds', async () => {
        mockNetwork.isUnreachable = true;
        const cashlink = new CashlinkInteractive(new Cashlink(CashlinkCurrency.NIM, SECRET, CASHLINK_ADDRESS, VALUE));
        await waitFor(() => !!cashlink.updateError);
        expect(cashlink.updateError!.message).toBe('Network unreachable');
        expect(cashlink.state).toBe(CashlinkState.UNKNOWN);

        // Updating again fails, too, as long as the network is unreachable. The previous error is reset meanwhile.
        const failingUpdate = cashlink.update();
        expect(cashlink.updateError).toBe(null);
        await expect(failingUpdate).rejects.toThrow('Network unreachable');
        expect(cashlink.updateError!.message).toBe('Network unreachable');

        mockNetwork.isUnreachable = false;
        mockNetwork.balance = VALUE;
        await cashlink.update();
        expect(cashlink.updateError).toBe(null);
        await waitFor(() => cashlink.state === CashlinkState.UNCLAIMED);
    });

    it('reports if its balance could not be updated on a new transaction, until it got updated', async () => {
        const cashlink = await createCashlink(/* single-claimable */ VALUE);
        await waitFor(() => mockNetwork.transactionListeners.length === 1);
        expect(cashlink.updateError).toBe(null);

        // The Cashlink gets claimed by somebody else, but the update for that transaction fails.
        mockNetwork.isUnreachable = true;
        mockNetwork.transactionListeners[0]({
            transactionHash: 'cd'.repeat(32),
            sender: CASHLINK_ADDRESS,
            recipient: RECIPIENT_ADDRESS,
            state: 'included',
        });
        await waitFor(() => !!cashlink.updateError);
        expect(cashlink.updateError!.message).toBe('Network unreachable');
        expect(cashlink.state).toBe(CashlinkState.UNCLAIMED); // outdated

        // Detecting the state alone does not make up for the failed update of the balance.
        mockNetwork.isUnreachable = false;
        await cashlink.detectState();
        expect(cashlink.updateError!.message).toBe('Network unreachable');
        await cashlink.update();
        expect(cashlink.updateError).toBe(null);
    });

    it('reports if its state could not be detected, whoever requested the detection', async () => {
        const cashlink = await createCashlink(/* single-claimable */ VALUE);

        // A detection requested from outside.
        mockNetwork.isUnreachable = true;
        await expect(cashlink.detectState()).rejects.toThrow('Network unreachable');
        expect(cashlink.updateError!.message).toBe('Network unreachable');
        mockNetwork.isUnreachable = false;
        await cashlink.detectState();
        expect(cashlink.updateError).toBe(null);

        // The detection after a failed claim.
        const failingClaim = cashlink.claim(RECIPIENT_ADDRESS);
        await waitFor(() => mockNetwork.relays.length === 1);
        mockNetwork.isUnreachable = true;
        mockNetwork.relays[0].reject(new Error('Failed to relay'));
        await expect(failingClaim).rejects.toThrow('Failed to relay');
        await waitFor(() => !!cashlink.updateError);
        expect(cashlink.updateError!.message).toBe('Network unreachable');
        expect(cashlink.state).toBe(CashlinkState.CLAIMING);
    });
});
