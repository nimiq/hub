import { setup } from './_setup';
import Config from 'config';
import {
    parseSignTransactionRequest,
    patchLegacyRequestSenderType,
    rawSignTransactionRequest,
} from '@/lib/SignTransactionRequestParsing';
import type { ParsedSignTransactionRequest } from '@/lib/RequestTypes';
import type { SignTransactionRequest } from '../../client/PublicRequestTypes';

setup();

// These tests pin the SIGN_TRANSACTION request validation, which is a port of the Keyguard's reviewed
// implementation (see SignTransactionRequestParsing.ts). Note that the Keyguard itself has no tests for its
// parsing, such that this is the only test coverage of these checks.

const APP_NAME = 'Test App';
const SENDER = 'NQ73 822X Q55C EQ9N BV36 DD59 TMED X511 TQAY';
const RECIPIENT = 'NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU';
const OTHER = 'NQ46 2RM7 QE4T 82KR 61Q9 9B7E R38G LBVM N6KY';
const VALIDATOR = 'NQ70 APBA 9GCC FL44 D82R UJCD DS4B Y824 3LYJ';
const FROM_VALIDATOR = 'NQ94 DA1Q SVB4 61YN XEY6 2TVT F22G 0381 L284';
const VALIDITY_START_HEIGHT = 1000;

const networkId = () => Config.nimiqNetworkId;
const address = (userFriendly: string) => Nimiq.Address.fromString(userFriendly);
const epoch = () => Nimiq.Policy.BLOCKS_PER_EPOCH;

function basicTx(sender: string = SENDER, recipient: string = RECIPIENT, validityStartHeight?: number, netId?: number) {
    return Nimiq.TransactionBuilder.newBasic(
        address(sender),
        address(recipient),
        BigInt(100000),
        BigInt(0),
        validityStartHeight !== undefined ? validityStartHeight : VALIDITY_START_HEIGHT,
        netId !== undefined ? netId : networkId(),
    );
}

function switchValidatorTxs(options: {
    updateStakerSender?: string,
    updateStakerDelay?: number,
    newActiveBalance?: bigint,
    newDelegation?: Nimiq.Address,
    reactivateAllStake?: boolean,
} = {}): [Nimiq.Transaction, Nimiq.Transaction] {
    const setActiveStakeTx = Nimiq.TransactionBuilder.newSetActiveStake(
        address(SENDER),
        options.newActiveBalance !== undefined ? options.newActiveBalance : BigInt(0),
        BigInt(0),
        VALIDITY_START_HEIGHT,
        networkId(),
    );
    const updateStakerTx = Nimiq.TransactionBuilder.newUpdateStaker(
        address(options.updateStakerSender || SENDER),
        'newDelegation' in options ? options.newDelegation : address(VALIDATOR),
        options.reactivateAllStake !== undefined ? options.reactivateAllStake : true,
        BigInt(0),
        VALIDITY_START_HEIGHT + (options.updateStakerDelay !== undefined ? options.updateStakerDelay : epoch() + 1),
        networkId(),
    );
    return [setActiveStakeTx, updateStakerTx];
}

function switchValidatorRequest(
    transactions: Array<Nimiq.Transaction | Uint8Array>,
    extraFields: object = {},
): SignTransactionRequest {
    return {
        appName: APP_NAME,
        sender: SENDER,
        layout: 'switch-validator',
        transactions: transactions.map((tx) => tx instanceof Uint8Array ? tx : tx.serialize()),
        fromValidatorAddress: FROM_VALIDATOR,
        ...extraFields,
    } as SignTransactionRequest;
}

function unstakingTxs(options: {
    retireStake?: bigint,
    retireStakeDelay?: number,
    removeStake?: Nimiq.Transaction,
    removeStakeRecipient?: string,
    removeStakeDelayAfterRetire?: number,
} = {}): [Nimiq.Transaction, Nimiq.Transaction, Nimiq.Transaction] {
    const amount = BigInt(100000);
    const retireStakeDelay = options.retireStakeDelay !== undefined ? options.retireStakeDelay : epoch() + 1;
    const setActiveStakeTx = Nimiq.TransactionBuilder.newSetActiveStake(
        address(SENDER),
        BigInt(0),
        BigInt(0),
        VALIDITY_START_HEIGHT,
        networkId(),
    );
    const retireStakeTx = Nimiq.TransactionBuilder.newRetireStake(
        address(SENDER),
        options.retireStake !== undefined ? options.retireStake : amount,
        BigInt(0),
        VALIDITY_START_HEIGHT + retireStakeDelay,
        networkId(),
    );
    const removeStakeTx = options.removeStake || Nimiq.TransactionBuilder.newRemoveStake(
        address(options.removeStakeRecipient || SENDER),
        amount,
        BigInt(0),
        VALIDITY_START_HEIGHT + retireStakeDelay
            + (options.removeStakeDelayAfterRetire !== undefined ? options.removeStakeDelayAfterRetire : 1),
        networkId(),
    );
    return [setActiveStakeTx, retireStakeTx, removeStakeTx];
}

function unstakingRequest(
    transactions: Nimiq.Transaction[],
    extraFields: object = {},
): SignTransactionRequest {
    return {
        appName: APP_NAME,
        sender: SENDER,
        layout: 'unstaking',
        transactions: transactions.map((tx) => tx.serialize()),
        validatorAddress: VALIDATOR,
        ...extraFields,
    } as SignTransactionRequest;
}

function payoutToUserTx(recipient: string = SENDER, amount: bigint = BigInt(100000)) {
    return Nimiq.TransactionBuilder.newRemoveStake(
        address(recipient),
        amount,
        BigInt(0),
        VALIDITY_START_HEIGHT,
        networkId(),
    );
}

// Re-creates an incoming staking transaction with a contract sender at the same address. Note that such a transaction
// passes the request-level sender binding, which compares the sender address and not its type.
function withContractSender(tx: Nimiq.Transaction) {
    return new Nimiq.Transaction(
        tx.sender, Nimiq.AccountType.Vesting, tx.senderData,
        tx.recipient, tx.recipientType, tx.data,
        tx.value, tx.fee, tx.flags, tx.validityStartHeight, networkId(),
    );
}

function expectParsedEqual(actual: ParsedSignTransactionRequest, expected: ParsedSignTransactionRequest) {
    expect(actual.kind).toBe(expected.kind);
    expect(actual.appName).toBe(expected.appName);
    expect(actual.layout).toBe(expected.layout);
    expect((actual.sender as Nimiq.Address).toUserFriendlyAddress())
        .toBe((expected.sender as Nimiq.Address).toUserFriendlyAddress());
    expect(actual.transactions.map((tx) => Array.from(tx.serialize())))
        .toEqual(expected.transactions.map((tx) => Array.from(tx.serialize())));
    expect(actual.senderLabel).toBe(expected.senderLabel);
    expect(actual.recipientLabel).toBe(expected.recipientLabel);
    expect(actual.validatorAddress && actual.validatorAddress.toUserFriendlyAddress())
        .toBe(expected.validatorAddress && expected.validatorAddress.toUserFriendlyAddress());
    expect(actual.validatorImageUrl && actual.validatorImageUrl.toString())
        .toBe(expected.validatorImageUrl && expected.validatorImageUrl.toString());
    expect(actual.fromValidatorAddress && actual.fromValidatorAddress.toUserFriendlyAddress())
        .toBe(expected.fromValidatorAddress && expected.fromValidatorAddress.toUserFriendlyAddress());
    expect(actual.fromValidatorImageUrl && actual.fromValidatorImageUrl.toString())
        .toBe(expected.fromValidatorImageUrl && expected.fromValidatorImageUrl.toString());
}

describe('SignTransactionRequestParsing', () => {
    describe('request structure and layout', () => {
        it('parses a legacy single-transaction request into a one-element transactions array', () => {
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                recipient: RECIPIENT,
                recipientLabel: 'Alice',
                value: 12345,
                fee: 7,
                extraData: 'hello',
                validityStartHeight: VALIDITY_START_HEIGHT,
            });
            expect(parsed.layout).toBe('standard');
            expect(parsed.transactions.length).toBe(1);
            const [tx] = parsed.transactions;
            expect(tx.sender.toUserFriendlyAddress()).toBe(SENDER);
            expect(tx.senderType).toBe(Nimiq.AccountType.Basic);
            expect(tx.recipient.toUserFriendlyAddress()).toBe(RECIPIENT);
            expect(tx.value).toBe(BigInt(12345));
            expect(tx.fee).toBe(BigInt(7));
            expect(Array.from(tx.data)).toEqual([104, 101, 108, 108, 111]); // 'hello' in utf8
            expect(tx.validityStartHeight).toBe(VALIDITY_START_HEIGHT);
            expect(parsed.recipientLabel).toBe('Alice');
        });

        it('accepts a validityStartHeight of 0', () => {
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                recipient: RECIPIENT,
                value: 12345,
                validityStartHeight: 0,
            });
            expect(parsed.transactions[0].validityStartHeight).toBe(0);
        });

        it('rejects non-array and empty transactions', () => {
            const base = { appName: APP_NAME, sender: SENDER };
            expect(() => parseSignTransactionRequest(
                { ...base, transactions: 'foo' } as any as SignTransactionRequest,
            )).toThrow('transactions must be an array');
            expect(() => parseSignTransactionRequest(
                { ...base, transactions: [] } as any as SignTransactionRequest,
            )).toThrow('transactions array must not be empty');
        });

        it('rejects invalid layouts', () => {
            for (const layout of ['checkout', 'cashlink', 'garbage']) {
                expect(() => parseSignTransactionRequest({
                    appName: APP_NAME,
                    sender: SENDER,
                    layout,
                    transactions: [basicTx().serialize()],
                } as any as SignTransactionRequest)).toThrow('Invalid selected layout');
            }
        });

        it('rejects a legacy single-transaction request with a staking layout by transaction count', () => {
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                recipient: RECIPIENT,
                value: 12345,
                validityStartHeight: VALIDITY_START_HEIGHT,
                layout: 'unstaking',
                validatorAddress: VALIDATOR,
            } as any as SignTransactionRequest)).toThrow('unstaking layout requires exactly three transactions');
        });
    });

    describe('serialized transaction entries', () => {
        it('rejects garbage bytes', () => {
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [new Uint8Array([1, 2, 3])],
            })).toThrow();
        });

        it('rejects a transaction whose sender matches its recipient', () => {
            const tx = new Nimiq.Transaction(
                address(SENDER), Nimiq.AccountType.Basic, new Uint8Array(0),
                address(SENDER), Nimiq.AccountType.Basic, new Uint8Array(0),
                BigInt(100000), BigInt(0), Nimiq.TransactionFlag.None, VALIDITY_START_HEIGHT, networkId(),
            );
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [tx.serialize()],
            })).toThrow('Sender and recipient must not match');
        });

        it('rejects a transaction of a different network', () => {
            const tx = basicTx(SENDER, RECIPIENT, VALIDITY_START_HEIGHT, networkId() === 5 ? 24 : 5);
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [tx.serialize()],
            })).toThrow('Wrong transaction network');
        });
    });

    describe('transaction info object entries', () => {
        it('inherits the request-level sender and defaults to a basic sender', () => {
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [{
                    recipient: RECIPIENT,
                    value: 100000,
                    validityStartHeight: VALIDITY_START_HEIGHT,
                }],
            });
            const [tx] = parsed.transactions;
            expect(tx.sender.toUserFriendlyAddress()).toBe(SENDER);
            expect(tx.senderType).toBe(Nimiq.AccountType.Basic);
            expect(tx.fee).toBe(BigInt(0));
        });

        it('supports mixed serialized and object entries', () => {
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [
                    basicTx().serialize(),
                    {
                        recipient: OTHER,
                        value: 100000,
                        validityStartHeight: VALIDITY_START_HEIGHT,
                    },
                ],
            });
            expect(parsed.transactions.length).toBe(2);
            expect(parsed.transactions[1].sender.toUserFriendlyAddress()).toBe(SENDER);
        });

        it('rejects invalid sender and recipient types', () => {
            const base = {
                appName: APP_NAME,
                sender: SENDER,
                transactions: [{
                    recipient: RECIPIENT,
                    value: 100000,
                    validityStartHeight: VALIDITY_START_HEIGHT,
                }],
            };
            expect(() => parseSignTransactionRequest({
                ...base,
                transactions: [{ ...base.transactions[0], senderType: 99 }],
            } as any as SignTransactionRequest)).toThrow('Invalid sender type');
            expect(() => parseSignTransactionRequest({
                ...base,
                transactions: [{ ...base.transactions[0], recipientType: 99 }],
            } as any as SignTransactionRequest)).toThrow('Invalid recipient type');
        });

        it('utf8-encodes string recipientData', () => {
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [{
                    recipient: RECIPIENT,
                    recipientData: 'hi',
                    value: 100000,
                    validityStartHeight: VALIDITY_START_HEIGHT,
                }],
            });
            expect(Array.from(parsed.transactions[0].data)).toEqual([104, 105]);
        });

        it('caps recipientData at 64 bytes for non-staking recipients', () => {
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [{
                    recipient: RECIPIENT,
                    recipientData: new Uint8Array(65),
                    value: 100000,
                    validityStartHeight: VALIDITY_START_HEIGHT,
                }],
            })).toThrow('Data must not exceed 64 bytes');
        });

        it('does not apply the 64 byte cap for staking recipients', () => {
            // Use real update-staker recipient data (> 64 bytes including the zeroed staking proof placeholder)
            // to also cover expressing a staking transaction as an object entry.
            const [, updateStakerTx] = switchValidatorTxs();
            expect(updateStakerTx.data.byteLength).toBeGreaterThan(64);
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [{
                    recipient: updateStakerTx.recipient.toUserFriendlyAddress(),
                    recipientType: Nimiq.AccountType.Staking,
                    recipientData: updateStakerTx.data,
                    value: 0,
                    flags: updateStakerTx.flags,
                    validityStartHeight: VALIDITY_START_HEIGHT,
                }],
            });
            expect(Array.from(parsed.transactions[0].data)).toEqual(Array.from(updateStakerTx.data));
        });

        it('accepts contract creations via the CONTRACT_CREATION pseudo recipient', () => {
            // Nimiq.Transaction derives the created contract's address from the other transaction parameters and
            // replaces whatever recipient is passed to it with that address, which is why contract creations must
            // not specify a recipient. Building the reference transaction with a recipient address different to
            // the placeholder address the parsing passes pins that neither ends up in the parsed transaction.
            for (const [recipientType, byteLength] of [
                [Nimiq.AccountType.HTLC, 82],
                [Nimiq.AccountType.Vesting, 28],
                [Nimiq.AccountType.Vesting, 44],
                [Nimiq.AccountType.Vesting, 52],
            ] as Array<[Nimiq.AccountType, number]>) {
                const recipientData = new Uint8Array(byteLength);
                const parsed = parseSignTransactionRequest({
                    appName: APP_NAME,
                    sender: SENDER,
                    transactions: [{
                        recipient: 'CONTRACT_CREATION',
                        recipientType,
                        recipientData,
                        flags: Nimiq.TransactionFlag.ContractCreation,
                        value: 100000,
                        validityStartHeight: VALIDITY_START_HEIGHT,
                    }],
                });
                const reference = new Nimiq.Transaction(
                    address(SENDER), Nimiq.AccountType.Basic, new Uint8Array(0),
                    address(OTHER), recipientType, recipientData,
                    BigInt(100000), BigInt(0), Nimiq.TransactionFlag.ContractCreation,
                    VALIDITY_START_HEIGHT, networkId(),
                );
                const [transaction] = parsed.transactions;
                expect(transaction.flags).toBe(Nimiq.TransactionFlag.ContractCreation);
                expect(transaction.recipient.toUserFriendlyAddress())
                    .toBe(reference.recipient.toUserFriendlyAddress());
                expect(transaction.recipient.toUserFriendlyAddress()).not.toBe(OTHER);
                expect(Array.from(transaction.serialize())).toEqual(Array.from(reference.serialize()));
            }
        });

        it('rejects contract creations with a recipient address', () => {
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [{
                    recipient: RECIPIENT,
                    recipientType: Nimiq.AccountType.HTLC,
                    recipientData: new Uint8Array(82),
                    flags: Nimiq.TransactionFlag.ContractCreation,
                    value: 100000,
                    validityStartHeight: VALIDITY_START_HEIGHT,
                }],
            })).toThrow('Transaction recipient must be "CONTRACT_CREATION" when creating contracts');
        });

        it('rejects the CONTRACT_CREATION pseudo recipient without the contract creation flag', () => {
            // Without this check, the placeholder address passed to Nimiq.Transaction for the pseudo recipient
            // would end up in the transaction as an actual recipient, sending the funds to the burn address.
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [{
                    recipient: 'CONTRACT_CREATION',
                    value: 100000,
                    validityStartHeight: VALIDITY_START_HEIGHT,
                }],
            })).toThrow('Transaction recipient can only be "CONTRACT_CREATION" when creating contracts');
        });

        it('rejects contract creation data of invalid length', () => {
            for (const byteLength of [0, 27, 29, 43, 81, 83]) {
                expect(() => parseSignTransactionRequest({
                    appName: APP_NAME,
                    sender: SENDER,
                    transactions: [{
                        recipient: 'CONTRACT_CREATION',
                        recipientType: Nimiq.AccountType.HTLC,
                        recipientData: new Uint8Array(byteLength),
                        flags: Nimiq.TransactionFlag.ContractCreation,
                        value: 100000,
                        validityStartHeight: VALIDITY_START_HEIGHT,
                    }],
                })).toThrow('Contract creation data must be 82 bytes for HTLC and 28, 44, or 52 bytes for vesting '
                    + 'contracts');
            }
        });

        it('rejects flags that are not a single known flag', () => {
            // Nimiq.Transaction truncates fractional flags and flags exceeding a byte, and normalizes the contract
            // creation flag combined with the signaling flag to plain contract creation, in each case replacing
            // the requested recipient with the created contract's address, such that these values would pass the
            // checks above as a substitute for the plain contract creation flag.
            const contractCreationFlags = Nimiq.TransactionFlag.ContractCreation;
            for (const flags of [
                contractCreationFlags | Nimiq.TransactionFlag.Signaling, // tslint:disable-line no-bitwise
                1.5, // truncated to ContractCreation
                257, // truncated to ContractCreation
            ]) {
                expect(() => parseSignTransactionRequest({
                    appName: APP_NAME,
                    sender: SENDER,
                    transactions: [{
                        recipient: RECIPIENT,
                        recipientType: Nimiq.AccountType.HTLC,
                        recipientData: new Uint8Array(82),
                        flags,
                        value: 100000,
                        validityStartHeight: VALIDITY_START_HEIGHT,
                    }],
                })).toThrow('Combined flags are not supported for transaction entries');
            }
        });

        it('rejects addresses that are not addresses', () => {
            // The Nimiq.Address constructor converts array-likes into an arbitrary address instead of rejecting
            // them; for example new Nimiq.Address({length: 20}) yields the zero address.
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [{
                    recipient: { length: 20 },
                    value: 100000,
                    validityStartHeight: VALIDITY_START_HEIGHT,
                }],
            } as any as SignTransactionRequest)).toThrow('recipient must be a valid Nimiq address');
        });
    });

    describe('aggregate and ordering checks', () => {
        it('rejects total values above Number.MAX_SAFE_INTEGER', () => {
            const half = BigInt('5000000000000000'); // 5e15; two of these exceed MAX_SAFE_INTEGER (~9e15)
            const transactions = [RECIPIENT, OTHER].map((recipient, i) => new Nimiq.Transaction(
                address(SENDER), Nimiq.AccountType.Basic, new Uint8Array(0),
                address(recipient), Nimiq.AccountType.Basic, new Uint8Array(0),
                half, BigInt(0), Nimiq.TransactionFlag.None, VALIDITY_START_HEIGHT + i, networkId(),
            ).serialize());
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions,
            })).toThrow('Total value or fee across transactions exceeds safe integer limit');
        });

        it('rejects transactions with decreasing validity start heights', () => {
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [
                    basicTx(SENDER, RECIPIENT, 100).serialize(),
                    basicTx(SENDER, OTHER, 50).serialize(),
                ],
            })).toThrow('Transactions must be valid in order');
        });
    });

    describe('staker proofs and sender binding', () => {
        it('rejects incoming staking transactions with a user-provided staking proof', () => {
            const [setActiveStakeTx, updateStakerTx] = switchValidatorTxs();
            const keyPair = Nimiq.KeyPair.derive(new Nimiq.PrivateKey(new Uint8Array([
                70, 207, 252, 77, 192, 84, 237, 202, 3, 46, 88, 64, 101, 200, 131, 19, 212,
                105, 128, 49, 54, 99, 159, 166, 103, 196, 208, 178, 26, 244, 184, 234,
            ])));
            updateStakerTx.sign(keyPair, keyPair); // fills the staking proof in the recipient data
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest([setActiveStakeTx, updateStakerTx]),
            )).toThrow('Staking transactions with a user-provided signature proof are not supported');
        });

        it('accepts incoming staking transactions with the zeroed placeholder proof', () => {
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest(switchValidatorTxs()),
            )).not.toThrow();
        });

        it('rejects transactions with a sender other than the request sender', () => {
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [basicTx(OTHER, RECIPIENT).serialize()],
            })).toThrow('Transaction sender must match request sender');
        });

        it('rejects transactions from a contract other than the request sender', () => {
            // The signing key is resolved from the request sender only - for a contract sender that is the
            // contract's owner - so a transaction from another sender, which the user may well be able to sign
            // for, must not ride along with a request for a different sender.
            const contractTx = new Nimiq.Transaction(
                address(OTHER), Nimiq.AccountType.Vesting, new Uint8Array(0),
                address(RECIPIENT), Nimiq.AccountType.Basic, new Uint8Array(0),
                BigInt(100000), BigInt(0), Nimiq.TransactionFlag.None, VALIDITY_START_HEIGHT, networkId(),
            );
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [basicTx().serialize(), contractTx.serialize()],
            })).toThrow('Transaction sender must match request sender');
        });

        it('accepts transactions from a contract that is the request sender', () => {
            // Sending from one's own vesting or HTLC contract is supported; the request sender is then the
            // contract, for which the views resolve the contract's owner as the signer.
            const contractTx = new Nimiq.Transaction(
                address(SENDER), Nimiq.AccountType.Vesting, new Uint8Array(0),
                address(RECIPIENT), Nimiq.AccountType.Basic, new Uint8Array(0),
                BigInt(100000), BigInt(0), Nimiq.TransactionFlag.None, VALIDITY_START_HEIGHT, networkId(),
            );
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [contractTx.serialize()],
            });
            expect(parsed.transactions[0].senderType).toBe(Nimiq.AccountType.Vesting);
        });

        it('rejects outgoing staking transactions that do not pay out to the request sender', () => {
            // An outgoing staking transaction is sent from the staking contract and is therefore bound to the
            // request sender via its payout address instead.
            const removeStakeTx = Nimiq.TransactionBuilder.newRemoveStake(
                address(OTHER), BigInt(100000), BigInt(0), VALIDITY_START_HEIGHT, networkId(),
            );
            expect(() => parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [removeStakeTx.serialize()],
            })).toThrow('Outgoing staking transactions must pay out to the request sender');
        });

        it('rejects staking layout transactions whose fee-payer is not the request sender', () => {
            // The layout's own same-fee-payer check is unreachable here, as both senders are individually bound
            // to the request sender; the binding is what fires.
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest(switchValidatorTxs({ updateStakerSender: OTHER })),
            )).toThrow('Transaction sender must match request sender');
        });
    });

    describe('standard layout labels', () => {
        it('parses the recipient label for a single transaction', () => {
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [basicTx().serialize()],
                recipientLabel: 'You',
            });
            expect(parsed.recipientLabel).toBe('You');
        });

        it('does not accept a requested label for the user\'s own sender account', () => {
            // A caller must not be able to relabel the user's own account, for example as a well-known account,
            // on the confirmation screens; the label is taken from the user's account data in the views.
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [basicTx().serialize()],
                senderLabel: 'Nimiq Foundation Cold Wallet',
            } as any as SignTransactionRequest);
            expect(parsed.senderLabel).toBeUndefined();
        });

        it('does not accept a requested label for a recipient that is the user\'s own address', () => {
            // Outgoing staking transactions, e.g. remove-stake, are sent from the staking contract and pay out to
            // the request sender, i.e. the user's own account is the recipient, which a caller must not be able to
            // relabel. The label is taken from the user's account data in the views.
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [payoutToUserTx().serialize()],
                recipientLabel: 'Shop XYZ Payment',
            });
            expect(parsed.transactions[0].senderType).toBe(Nimiq.AccountType.Staking);
            expect(parsed.transactions[0].recipient.toUserFriendlyAddress()).toBe(SENDER);
            expect(parsed.recipientLabel).toBeUndefined();
        });

        it('ignores labels for multiple transactions', () => {
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [
                    basicTx(SENDER, RECIPIENT).serialize(),
                    basicTx(SENDER, OTHER).serialize(),
                ],
                recipientLabel: 'You',
            });
            expect(parsed.senderLabel).toBeUndefined();
            expect(parsed.recipientLabel).toBeUndefined();
        });

        it('rejects overlong labels and labels with control characters', () => {
            const base = {
                appName: APP_NAME,
                sender: SENDER,
                transactions: [basicTx().serialize()],
            };
            expect(() => parseSignTransactionRequest({
                ...base,
                recipientLabel: 'x'.repeat(64),
            })).toThrow('recipientLabel must not exceed 63 bytes');
            expect(() => parseSignTransactionRequest({
                ...base,
                recipientLabel: 'new\nline',
            })).toThrow('Label cannot contain control characters');
        });
    });

    describe('switch-validator layout', () => {
        it('parses a valid request and derives the validator from the signed newDelegation', () => {
            const parsed = parseSignTransactionRequest(switchValidatorRequest(switchValidatorTxs(), {
                senderLabel: 'From Validator',
                recipientLabel: 'To Validator',
                // A request-provided validatorAddress must not influence the derived one.
                validatorAddress: OTHER,
                validatorImageUrl: 'https://example.com/validator.png',
                fromValidatorImageUrl: 'https://example.com/from-validator.png',
            }));
            expect(parsed.layout).toBe('switch-validator');
            expect(parsed.validatorAddress!.toUserFriendlyAddress()).toBe(VALIDATOR);
            expect(parsed.fromValidatorAddress!.toUserFriendlyAddress()).toBe(FROM_VALIDATOR);
            expect(parsed.senderLabel).toBe('From Validator');
            expect(parsed.recipientLabel).toBe('To Validator');
            expect(parsed.validatorImageUrl!.toString()).toBe('https://example.com/validator.png');
        });

        it('accepts an update-staker delay of exactly two epochs', () => {
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest(switchValidatorTxs({ updateStakerDelay: 2 * epoch() })),
            )).not.toThrow();
        });

        it('does not accept a requested label for the user\'s own staking address', () => {
            // The stake belongs to the user's own address; same as for the standard layout's sender, a caller must
            // not be able to relabel it. The label is taken from the user's account data in the views.
            const parsed = parseSignTransactionRequest(switchValidatorRequest(switchValidatorTxs(), {
                stakerLabel: 'My Stake',
            }));
            expect((parsed as any).stakerLabel).toBeUndefined();
        });

        it('rejects transaction counts other than two', () => {
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest([switchValidatorTxs()[0]]),
            )).toThrow('switch-validator layout requires exactly two transactions');
        });

        it('rejects contract senders', () => {
            const [setActiveStakeTx, updateStakerTx] = switchValidatorTxs();
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest([withContractSender(setActiveStakeTx), updateStakerTx]),
            )).toThrow('switch-validator transaction sender must not be a contract');
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest([setActiveStakeTx, withContractSender(updateStakerTx)]),
            )).toThrow('switch-validator transaction sender must not be a contract');
        });

        it('rejects wrong transaction data types', () => {
            const [setActiveStakeTx] = switchValidatorTxs();
            const secondSetActiveStakeTx = Nimiq.TransactionBuilder.newSetActiveStake(
                address(SENDER), BigInt(0), BigInt(0), VALIDITY_START_HEIGHT + epoch() + 1, networkId(),
            );
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest([setActiveStakeTx, secondSetActiveStakeTx]),
            )).toThrow('switch-validator transactions must be set-active-stake followed by update-staker');
        });

        it('rejects set-active-stake transactions that do not deactivate all stake', () => {
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest(switchValidatorTxs({ newActiveBalance: BigInt(5) })),
            )).toThrow('switch-validator set-active-stake must deactivate all stake');
        });

        it('rejects update-staker transactions without a newDelegation', () => {
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest(switchValidatorTxs({ newDelegation: undefined })),
            )).toThrow('switch-validator update-staker must include a newDelegation');
        });

        it('rejects update-staker transactions without reactivateAllStake', () => {
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest(switchValidatorTxs({ reactivateAllStake: false })),
            )).toThrow('switch-validator update-staker must have reactivateAllStake set');
        });

        it('rejects update-staker delays outside of one to two epochs', () => {
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest(switchValidatorTxs({ updateStakerDelay: epoch() })),
            )).toThrow('switch-validator update-staker must start one to two epochs after set-active-stake');
            expect(() => parseSignTransactionRequest(
                switchValidatorRequest(switchValidatorTxs({ updateStakerDelay: 2 * epoch() + 1 })),
            )).toThrow('switch-validator update-staker must start one to two epochs after set-active-stake');
        });

        it('requires fromValidatorAddress', () => {
            expect(() => parseSignTransactionRequest(switchValidatorRequest(switchValidatorTxs(), {
                fromValidatorAddress: undefined,
            }))).toThrow('fromValidatorAddress must be a valid Nimiq address');
        });
    });

    describe('unstaking layout', () => {
        it('parses a valid request', () => {
            const parsed = parseSignTransactionRequest(unstakingRequest(unstakingTxs(), {
                senderLabel: 'Validator',
                validatorImageUrl: 'https://example.com/validator.png',
            }));
            expect(parsed.layout).toBe('unstaking');
            expect(parsed.validatorAddress!.toUserFriendlyAddress()).toBe(VALIDATOR);
            expect(parsed.senderLabel).toBe('Validator');
            expect(parsed.transactions.length).toBe(3);
        });

        it('does not accept a requested label for the user\'s own payout address', () => {
            // The unstaked funds are paid out to the user's own address; same as for the standard layout's sender,
            // a caller must not be able to relabel it. The label is taken from the user's account data in the views.
            const parsed = parseSignTransactionRequest(unstakingRequest(unstakingTxs(), {
                recipientLabel: 'My Address',
            }));
            expect(parsed.recipientLabel).toBeUndefined();
        });

        it('rejects transaction counts other than three', () => {
            expect(() => parseSignTransactionRequest(
                unstakingRequest(unstakingTxs().slice(0, 2)),
            )).toThrow('unstaking layout requires exactly three transactions');
        });

        it('rejects contract senders', () => {
            const [setActiveStakeTx, retireStakeTx, removeStakeTx] = unstakingTxs();
            expect(() => parseSignTransactionRequest(
                unstakingRequest([withContractSender(setActiveStakeTx), retireStakeTx, removeStakeTx]),
            )).toThrow('unstaking transaction sender must not be a contract');
            expect(() => parseSignTransactionRequest(
                unstakingRequest([setActiveStakeTx, withContractSender(retireStakeTx), removeStakeTx]),
            )).toThrow('unstaking transaction sender must not be a contract');
        });

        it('rejects retiring more than is being paid out', () => {
            expect(() => parseSignTransactionRequest(
                unstakingRequest(unstakingTxs({ retireStake: BigInt(100001) })),
            )).toThrow('unstaking must not retire more than is being paid out');
        });

        it('rejects a payout to an address other than the fee payer and staker', () => {
            // Note that this is now already caught by the general binding of the transactions to the request
            // sender; the layout's own payout check, which the Keyguard needs as it has no request-level sender,
            // is kept as defense in depth and for diffability with the Keyguard.
            expect(() => parseSignTransactionRequest(
                unstakingRequest(unstakingTxs({ removeStakeRecipient: OTHER })),
            )).toThrow('Outgoing staking transactions must pay out to the request sender');
        });

        it('rejects a payout to a contract', () => {
            const [setActiveStakeTx, retireStakeTx, removeStakeTx] = unstakingTxs();
            const contractPayoutTx = new Nimiq.Transaction(
                removeStakeTx.sender, Nimiq.AccountType.Staking, removeStakeTx.senderData,
                address(SENDER), Nimiq.AccountType.Vesting, new Uint8Array(0),
                removeStakeTx.value, removeStakeTx.fee, removeStakeTx.flags,
                removeStakeTx.validityStartHeight, networkId(),
            );
            expect(() => parseSignTransactionRequest(
                unstakingRequest([setActiveStakeTx, retireStakeTx, contractPayoutTx]),
            )).toThrow('unstaking transactions must not payout to a contract');
        });

        it('rejects recipient data on the remove-stake transaction', () => {
            const [setActiveStakeTx, retireStakeTx, removeStakeTx] = unstakingTxs();
            const dataPayoutTx = new Nimiq.Transaction(
                removeStakeTx.sender, Nimiq.AccountType.Staking, removeStakeTx.senderData,
                address(SENDER), Nimiq.AccountType.Basic, new Uint8Array([1, 2, 3]),
                removeStakeTx.value, removeStakeTx.fee, removeStakeTx.flags,
                removeStakeTx.validityStartHeight, networkId(),
            );
            expect(() => parseSignTransactionRequest(
                unstakingRequest([setActiveStakeTx, retireStakeTx, dataPayoutTx]),
            )).toThrow('unstaking transactions must not have recipient data');
        });

        it('rejects retire-stake delays outside of one to two epochs', () => {
            expect(() => parseSignTransactionRequest(
                unstakingRequest(unstakingTxs({ retireStakeDelay: epoch() })),
            )).toThrow('unstaking retire-stake must start one to two epochs after set-active-stake');
            expect(() => parseSignTransactionRequest(
                unstakingRequest(unstakingTxs({ retireStakeDelay: 2 * epoch() + 1 })),
            )).toThrow('unstaking retire-stake must start one to two epochs after set-active-stake');
        });

        it('rejects a remove-stake that does not start one block after retire-stake', () => {
            expect(() => parseSignTransactionRequest(
                unstakingRequest(unstakingTxs({ removeStakeDelayAfterRetire: 2 })),
            )).toThrow('unstaking remove-stake must start one block after retire-stake');
        });

        it('requires validatorAddress', () => {
            expect(() => parseSignTransactionRequest(unstakingRequest(unstakingTxs(), {
                validatorAddress: undefined,
            }))).toThrow('validatorAddress must be a valid Nimiq address');
        });
    });

    describe('raw request export', () => {
        it('round-trips a legacy single-transaction request through the byte format', () => {
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                recipient: RECIPIENT,
                recipientLabel: 'Alice',
                value: 12345,
                fee: 7,
                extraData: 'hello',
                validityStartHeight: VALIDITY_START_HEIGHT,
            });
            const raw = rawSignTransactionRequest(parsed);
            expect('transactions' in raw && raw.transactions[0]).toBeInstanceOf(Uint8Array);
            expectParsedEqual(parseSignTransactionRequest(raw), parsed);
        });

        it('round-trips a standard multi-transaction request', () => {
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [
                    basicTx(SENDER, RECIPIENT).serialize(),
                    {
                        recipient: OTHER,
                        value: 100000,
                        validityStartHeight: VALIDITY_START_HEIGHT,
                    },
                ],
            });
            expectParsedEqual(parseSignTransactionRequest(rawSignTransactionRequest(parsed)), parsed);
        });

        it('round-trips a switch-validator request and omits the derived validatorAddress', () => {
            const parsed = parseSignTransactionRequest(switchValidatorRequest(switchValidatorTxs(), {
                senderLabel: 'From Validator',
                recipientLabel: 'To Validator',
                validatorImageUrl: 'https://example.com/validator.png',
            }));
            const raw = rawSignTransactionRequest(parsed);
            expect('validatorAddress' in raw ? (raw as any).validatorAddress : undefined).toBeUndefined();
            expectParsedEqual(parseSignTransactionRequest(raw), parsed);
        });

        it('round-trips an unstaking request including its validatorAddress', () => {
            const parsed = parseSignTransactionRequest(unstakingRequest(unstakingTxs(), {
                validatorImageUrl: 'https://example.com/validator.png',
            }));
            const raw = rawSignTransactionRequest(parsed);
            expect((raw as any).validatorAddress).toBe(VALIDATOR);
            expectParsedEqual(parseSignTransactionRequest(raw), parsed);
        });
    });

    describe('patchLegacyRequestSenderType', () => {
        const legacyRequest = (extraFields: object = {}) => parseSignTransactionRequest({
            appName: APP_NAME,
            sender: SENDER,
            recipient: RECIPIENT,
            value: 100000,
            fee: 138,
            extraData: new Uint8Array([1, 2, 3]),
            validityStartHeight: VALIDITY_START_HEIGHT,
            ...extraFields,
        } as SignTransactionRequest);

        it('applies the WalletStore contract type to a legacy request in place, changing nothing else', () => {
            const parsed = legacyRequest();
            const [original] = parsed.transactions;
            expect(original.senderType).toBe(Nimiq.AccountType.Basic);

            patchLegacyRequestSenderType(parsed, Nimiq.AccountType.Vesting);

            const [patched] = parsed.transactions;
            expect(patched).not.toBe(original);
            const reference = new Nimiq.Transaction(
                address(SENDER), Nimiq.AccountType.Vesting, new Uint8Array(0),
                address(RECIPIENT), Nimiq.AccountType.Basic, new Uint8Array([1, 2, 3]),
                BigInt(100000), BigInt(138), Nimiq.TransactionFlag.None, VALIDITY_START_HEIGHT, networkId(),
            );
            expect(Array.from(patched.serialize())).toEqual(Array.from(reference.serialize()));
            // The patched request survives the history state round-trip.
            expectParsedEqual(parseSignTransactionRequest(rawSignTransactionRequest(parsed)), parsed);
        });

        it('leaves a legacy request from a basic account untouched', () => {
            const parsed = legacyRequest();
            const [original] = parsed.transactions;
            patchLegacyRequestSenderType(parsed, Nimiq.AccountType.Basic);
            expect(parsed.transactions[0]).toBe(original);
        });

        it('keeps an explicitly specified non-basic sender type', () => {
            const vestingTx = new Nimiq.Transaction(
                address(SENDER), Nimiq.AccountType.Vesting, new Uint8Array(0),
                address(RECIPIENT), Nimiq.AccountType.Basic, new Uint8Array(0),
                BigInt(100000), BigInt(0), Nimiq.TransactionFlag.None, VALIDITY_START_HEIGHT, networkId(),
            );
            const parsed = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [vestingTx.serialize()],
            });
            const [original] = parsed.transactions;
            patchLegacyRequestSenderType(parsed, Nimiq.AccountType.HTLC);
            expect(parsed.transactions[0]).toBe(original);
            expect(parsed.transactions[0].senderType).toBe(Nimiq.AccountType.Vesting);
        });

        it('does not apply to multiple transactions or to the staking layouts', () => {
            const multi = parseSignTransactionRequest({
                appName: APP_NAME,
                sender: SENDER,
                transactions: [basicTx(SENDER, RECIPIENT).serialize(), basicTx(SENDER, OTHER).serialize()],
            });
            const [firstMulti, secondMulti] = multi.transactions;
            patchLegacyRequestSenderType(multi, Nimiq.AccountType.Vesting);
            expect(multi.transactions[0]).toBe(firstMulti);
            expect(multi.transactions[1]).toBe(secondMulti);

            const unstaking = parseSignTransactionRequest(unstakingRequest(unstakingTxs()));
            const [firstUnstaking] = unstaking.transactions;
            patchLegacyRequestSenderType(unstaking, Nimiq.AccountType.Vesting);
            expect(unstaking.transactions[0]).toBe(firstUnstaking);
        });

        it('re-derives the created contract address of a legacy contract creation', () => {
            // The created contract's address depends on the sender type, and Nimiq.Transaction derives it itself,
            // see the CONTRACT_CREATION test above. Rebuilding the transaction with the resolved sender type must
            // therefore result in the address of the contract created by a transaction with that sender type.
            const parsed = legacyRequest({
                recipient: 'CONTRACT_CREATION',
                recipientType: Nimiq.AccountType.Vesting,
                extraData: new Uint8Array(28),
                flags: Nimiq.TransactionFlag.ContractCreation,
            });
            const basicSenderContractAddress = parsed.transactions[0].recipient.toUserFriendlyAddress();

            patchLegacyRequestSenderType(parsed, Nimiq.AccountType.Vesting);

            const reference = new Nimiq.Transaction(
                address(SENDER), Nimiq.AccountType.Vesting, new Uint8Array(0),
                address(OTHER), Nimiq.AccountType.Vesting, new Uint8Array(28),
                BigInt(100000), BigInt(138), Nimiq.TransactionFlag.ContractCreation, VALIDITY_START_HEIGHT,
                networkId(),
            );
            const [patched] = parsed.transactions;
            expect(patched.recipient.toUserFriendlyAddress()).toBe(reference.recipient.toUserFriendlyAddress());
            expect(patched.recipient.toUserFriendlyAddress()).not.toBe(basicSenderContractAddress);
            expect(Array.from(patched.serialize())).toEqual(Array.from(reference.serialize()));
        });
    });
});
