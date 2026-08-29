import { Utf8Tools } from '@nimiq/utils';
import Config from 'config';
import { RequestType } from '../../client/PublicRequestTypes';
import type {
    SignTransactionRequest,
    SignTransactionRequestSwitchValidator,
    SignTransactionRequestUnstaking,
    TransactionInfo,
} from '../../client/PublicRequestTypes';
import { SignTransactionRequestLayout } from './RequestTypes';
import type { ParsedSignTransactionRequest } from './RequestTypes';
import { LABEL_MAX_LENGTH } from './Constants';

/**
 * Parsing of SIGN_TRANSACTION requests and their inverse mapping for the history state.
 *
 * This is a close port of the Keyguard's thoroughly reviewed request parsing, and should be kept diffable against it,
 * check for check (deviations are marked with comments):
 * - keyguard src/request/sign-transaction/SignTransactionApi.js (parseRequest and its helpers)
 * - keyguard src/lib/RequestParser.js (parseTransaction, parseLabel, parseAddress, _parseUrl)
 * The Keyguard re-validates forwarded requests with the original of these checks; for Ledger accounts, which don't
 * involve the Keyguard, this parsing is the only validation outside the checks and displayed information on the Ledger
 * itself.
 *
 * This module is deliberately kept free of imports of the app graph (RpcApi, router, views), such that unit tests can
 * import it standalone.
 */

export function parseSignTransactionRequest(request: SignTransactionRequest): ParsedSignTransactionRequest {
    // Hub deviation from the Keyguard: the sender address is a request-level field inherited by all transaction
    // entries, instead of a per-entry field, and there are no keyId / keyPath in the request; the signing account
    // is instead resolved from the WalletStore via the sender address, which RpcApi verifies to belong to one of
    // the user's wallets.
    const requestSender = parseAddress(request.sender, 'sender', false);
    const layout = parseLayout('layout' in request ? request.layout : undefined);

    let transactions: Nimiq.Transaction[];
    if ('transactions' in request) {
        if (!Array.isArray(request.transactions)) {
            throw new Error('transactions must be an array');
        }
        if (request.transactions.length === 0) {
            throw new Error('transactions array must not be empty');
        }

        transactions = request.transactions.map(
            (entry: TransactionInfo | Uint8Array) => {
                let tx: Nimiq.Transaction;
                if (entry instanceof Uint8Array) {
                    try {
                        tx = Nimiq.Transaction.deserialize(entry);
                    } catch (error) {
                        throw new Error(error instanceof Error ? error.message : String(error));
                    }
                    // Note that the transaction's sender is checked against the request-level sender in the loop
                    // over all parsed transactions below.
                    if (tx.sender.equals(tx.recipient)) {
                        throw new Error('Sender and recipient must not match');
                    }
                    if (tx.networkId !== Config.nimiqNetworkId) {
                        throw new Error('Wrong transaction network');
                    }
                } else {
                    tx = parseTransaction(entry, requestSender);
                }

                return tx;
            },
        );
    } else {
        // Legacy single-transaction request format (backwards compatible). Note that the legacy format does not include
        // the sender's account type; parseTransaction defaults it to Basic, and the actual type is resolved from the
        // WalletStore in the views, see ParsedSignTransactionRequest in RequestTypes.ts.
        transactions = [parseTransaction({
            recipient: request.recipient,
            recipientType: request.recipientType,
            recipientData: request.extraData,
            value: request.value,
            fee: request.fee,
            flags: request.flags,
            validityStartHeight: request.validityStartHeight,
        }, requestSender)];
    }

    // Reject requests where aggregated values would exceed Number.MAX_SAFE_INTEGER, as the conversion to Number for
    // display would lose precision.
    const totalValue = transactions.reduce((sum, { value }) => sum + value, BigInt(0));
    const totalFee = transactions.reduce((sum, { fee }) => sum + fee, BigInt(0));
    if (totalValue > Number.MAX_SAFE_INTEGER || totalFee > Number.MAX_SAFE_INTEGER) {
        throw new Error('Total value or fee across transactions exceeds safe integer limit');
    }

    let previousValidityStartHeight = -1;
    for (const transaction of transactions) {
        if (transaction.validityStartHeight < previousValidityStartHeight) {
            throw new Error('Transactions must be valid in order');
        }
        previousValidityStartHeight = transaction.validityStartHeight;

        // Validate the recipient data of incoming staking transactions, and reject those that carry a
        // user-provided staker / validator signature proof. The Keyguard's transaction.sign() would overwrite it
        // with a proof from the signing keypair, silently discarding the user's input. If multi-key staker
        // support is added later, this rejection can be relaxed, if appropriate display of the staker is added to
        // the UI.
        if (hasStakerOrValidatorProof(transaction)) {
            throw new Error('Staking transactions with a user-provided signature proof are not supported');
        }

        // Hub addition without direct Keyguard counterpart at parse time: check the transactions to be sent from
        // the request-level sender, from whose account the signing key is resolved (also for contract senders,
        // for which the signer is the contract's owner) and which RpcApi verifies to belong to one of the user's
        // wallets. As only a single signing key is resolved per request, transactions from another sender could
        // not be signed correctly anyway, and binding the transactions to the request sender is what makes
        // RpcApi's check meaningful for the funds that are actually spent. This is the parse-time analogue of the
        // Keyguard's signer check in SignTransaction._onConfirm, which can only run once the key is unlocked and
        // which therefore can only cover basic senders.
        if (transaction.senderType === Nimiq.AccountType.Staking) {
            // Outgoing staking transactions, e.g. remove-stake, are sent from the staking contract instead of from
            // the user's address, and the staker they pay out is determined by their signature proof, which is
            // created by the signing key. We determine the signer via requestSender and enforce the payout recipient
            // to match that address as otherwise the signing account would not be represented in the UI.
            if (!transaction.recipient.equals(requestSender)) {
                throw new Error('Outgoing staking transactions must pay out to the request sender');
            }
        } else if (!transaction.sender.equals(requestSender)) {
            throw new Error('Transaction sender must match request sender');
        }
    }

    const parsed: ParsedSignTransactionRequest = {
        kind: RequestType.SIGN_TRANSACTION,
        appName: request.appName,
        sender: requestSender,
        layout,
        transactions,
    };

    // Parse layout-specific fields.
    switch (layout) {
        case SignTransactionRequestLayout.STANDARD: {
            // Labels are only supported for requests with a single transaction; for multiple transactions, plain
            // addresses are displayed (same as in the Keyguard).
            // Deviation from the Keyguard, which also accepts a senderLabel for the standard layout: in the Hub, the
            // sender is the user's own account, for which the label is resolved from the WalletStore in the views. A
            // requested label is not accepted for it, as it would let a caller relabel the user's own account, for
            // example as a well-known account, on the confirmation screens.
            // No label is accepted for the recipient either, if the recipient is the user's own address. This is
            // the case for outgoing staking transactions, e.g. remove-stake or delete-validator, which are sent
            // from the staking contract and pay out to the request sender, see the sender binding above. The views
            // label that side from the user's account data instead.
            if ('recipientLabel' in request && transactions.length === 1
                && !transactions[0].recipient.equals(requestSender)) {
                parsed.recipientLabel = parseLabel(request.recipientLabel, 'recipientLabel');
            }
            break;
        }
        case SignTransactionRequestLayout.SWITCH_VALIDATOR: {
            const switchValidatorRequest = request as SignTransactionRequestSwitchValidator;
            if (transactions.length !== 2) {
                throw new Error('switch-validator layout requires exactly two transactions');
            }

            const [setActiveStakeTx, updateStakerTx] = transactions;

            // Check transactions to be of the expected format and disallow transactions that don't match the standard
            // case the simplified SWITCH_VALIDATOR layout represents. For example, the simplified layout relies on the
            // staker being the user and presents the transactions as operation on the user's own stake, displaying the
            // fee-paying sender as the staker. That the sender is in fact the user's own address is ensured by the
            // request-sender binding above together with RpcApi's wallet check, and re-checked by the Keyguard once
            // the key is unlocked, in SignTransaction._onConfirm.

            // For set-active-stake and update-staker transactions, we don't have to check the following, which are
            // checked by the Nimiq protocol (statically or on commit) or earlier parsing steps above, or are displayed:
            // - senderData (must be empty for transaction from basic account; enforced by protocol)
            // - recipient (must be staking contract for incoming staking transaction; enforced by protocol on commit)
            // - value (must be zero for signaling transactions; enforced by protocol)
            // - total fees (must not exceed MAX_SAFE_INTEGER; checked above and displayed)
            // - validityStartHeight (must be in order and within the typical bounds; checked above and below)
            // - network id (must match Config.nimiqNetworkId; checked above)
            // - flags (must be signaling for these transaction types; enforced by protocol)
            // What must still be checked here: sender, senderType, recipientType, recipientData

            if (!setActiveStakeTx.sender.equals(updateStakerTx.sender)) {
                // Enforce both transactions to have the same fee-payer. Note that the fee-payer is not necessarily
                // the same as the staker, because the staker is identified by the staking proof, which can differ
                // from the tx sender. However, we currently disallow custom staking proofs via the
                // hasStakerOrValidatorProof check above, such that both staking proofs are generated during signing
                // from the signing keypair. By this, the same staker is used for both transactions, and it also
                // matches the transaction senders, as we enforce the senders to be of basic type below and basic
                // senders to be the request sender above, which the Keyguard's signer check in
                // SignTransaction._onConfirm enforces to be that same keypair's address.
                // If we'd allow user-provided staking proofs in the future, we'd need to add a check that the
                // transaction stakers match and are the same as the transaction senders for the simplified
                // switch-validator flow.
                throw new Error('switch-validator transactions must share the same fee-paying sender and staker');
            }

            if (setActiveStakeTx.senderType !== Nimiq.AccountType.Basic
                || updateStakerTx.senderType !== Nimiq.AccountType.Basic) {
                // Enforce basic senders because the switch-validator UI does not show the sender being a contract,
                // and because the sender can only be checked to be the user's own address for basic senders, which
                // the staker equality above relies on.
                throw new Error('switch-validator transaction sender must not be a contract');
            }

            // recipientType and recipientData
            // Note that the staking proof on recipientData is already checked via hasStakerOrValidatorProof above.
            const [setActiveStakeData, updateStakerData] = [setActiveStakeTx, updateStakerTx]
                .map((tx) => parseIncomingStakingTransactionData(tx));
            if (!setActiveStakeData || setActiveStakeData.type !== 'set-active-stake'
                || !updateStakerData || updateStakerData.type !== 'update-staker') {
                throw new Error('switch-validator transactions must be set-active-stake followed by update-staker');
            }
            if (setActiveStakeData.newActiveBalance !== 0) {
                throw new Error(
                    'switch-validator set-active-stake must deactivate all stake (newActiveBalance must be 0)',
                );
            }
            if (!updateStakerData.newDelegation) {
                throw new Error('switch-validator update-staker must include a newDelegation');
            }
            if (!updateStakerData.reactivateAllStake) {
                throw new Error('switch-validator update-staker must have reactivateAllStake set');
            }

            // Check validityStartHeights to be what is expected from the Wallet.
            const updateStakerDelay = updateStakerTx.validityStartHeight - setActiveStakeTx.validityStartHeight;
            if (updateStakerDelay <= Nimiq.Policy.BLOCKS_PER_EPOCH
                || updateStakerDelay > 2 * Nimiq.Policy.BLOCKS_PER_EPOCH) {
                throw new Error('switch-validator update-staker must start one to two epochs after set-active-stake');
            }

            parsed.senderLabel = parseLabel(switchValidatorRequest.senderLabel, 'senderLabel');
            parsed.recipientLabel = parseLabel(switchValidatorRequest.recipientLabel, 'recipientLabel');
            parsed.fromValidatorAddress = parseAddress(
                switchValidatorRequest.fromValidatorAddress,
                'fromValidatorAddress',
                false,
            );
            // The signed delegation is authoritative - request data must not influence this.
            parsed.validatorAddress = parseAddress(
                updateStakerData.newDelegation,
                'update-staker newDelegation',
                false,
            );

            if (switchValidatorRequest.validatorImageUrl) {
                parsed.validatorImageUrl = parseUrl(switchValidatorRequest.validatorImageUrl, 'validatorImageUrl');
            }
            if (switchValidatorRequest.fromValidatorImageUrl) {
                parsed.fromValidatorImageUrl = parseUrl(
                    switchValidatorRequest.fromValidatorImageUrl,
                    'fromValidatorImageUrl',
                );
            }
            break;
        }
        case SignTransactionRequestLayout.UNSTAKING: {
            const unstakingRequest = request as SignTransactionRequestUnstaking;
            if (transactions.length !== 3) {
                throw new Error('unstaking layout requires exactly three transactions');
            }

            const [setActiveStakeTx, retireStakeTx, removeStakeTx] = transactions;

            // Check transactions to be of the expected format and disallow transactions that don't match the standard
            // case the simplified UNSTAKING layout represents. For example, the simplified layout relies on the staker
            // being the user and presents the transactions as operation on the user's own stake and does not display
            // the fee-paying sender at all. That the sender is in fact the user's own address is ensured by the
            // request-sender binding above together with RpcApi's wallet check, and re-checked by the Keyguard once
            // the key is unlocked, in SignTransaction._onConfirm.

            // setActiveStakeTx and retireStakeTx transactions
            // For setActiveStakeTx and retireStakeTx transactions, we don't have to check the following, which are
            // checked by the Nimiq protocol (statically or on commit) or earlier parsing steps above, or are displayed:
            // - senderData (must be empty for transaction from basic account; enforced by protocol)
            // - recipient (must be staking contract for incoming staking transaction; enforced by protocol on commit)
            // - value (must be zero for signaling transactions; enforced by protocol)
            // - total fees (must not exceed MAX_SAFE_INTEGER; checked above and displayed)
            // - validityStartHeight (must be in order and within the typical bounds; checked above and below)
            // - network id (must match Config.nimiqNetworkId; checked above)
            // - flags (must be signaling for these transaction types; enforced by protocol)
            // What must still be checked here: sender, senderType, recipientType, recipientData

            if (!setActiveStakeTx.sender.equals(retireStakeTx.sender)) {
                // Enforce the fee-payer to be the same for all three transactions: for incoming staking transactions
                // setActiveStakeTx and retireStakeTx the fee is paid by the transaction sender, while for the outgoing
                // removeStakeTx it is paid by the staker from the removed stake. Note that in general the fee-payer is
                // not necessarily the same as the staker, because the staker is identified by the staking proof.
                // However, we currently disallow custom staking proofs via the hasStakerOrValidatorProof check above,
                // such that the staking proofs of setActiveStakeTx and retireStakeTx are generated during signing from
                // the signing keypair, as is removeStakeTx's signature proof, which identifies its staker. By this,
                // the same staker is used for all three transactions, and it also matches the transaction senders, as
                // we enforce the senders to be of basic type below and basic senders to be the request sender above,
                // which the Keyguard's signer check in SignTransaction._onConfirm enforces to be that same keypair's
                // address.
                // If we'd allow user-provided staking proofs in the future, we'd need to add a check that the
                // transaction stakers match and are the same as the transaction senders for the simplified unstaking
                // flow.
                throw new Error('unstaking transactions must share the same fee-paying sender and staker');
            }

            if (setActiveStakeTx.senderType !== Nimiq.AccountType.Basic
                || retireStakeTx.senderType !== Nimiq.AccountType.Basic) {
                // Enforce basic senders because the unstaking UI does not show the sender being a contract, and
                // because the sender can only be checked to be the user's own address for basic senders, which the
                // staker equality above and the payout address check below rely on.
                throw new Error('unstaking transaction sender must not be a contract');
            }

            // recipientType and recipientData
            // Note that the staking proof on recipientData is already checked via hasStakerOrValidatorProof above and
            // the set-active-stake newActiveBalance is shown in the UI.
            const [setActiveStakeData, retireStakeData] = [setActiveStakeTx, retireStakeTx]
                .map((tx) => parseIncomingStakingTransactionData(tx));
            if (!setActiveStakeData || setActiveStakeData.type !== 'set-active-stake'
                || !retireStakeData || retireStakeData.type !== 'retire-stake') {
                throw new Error(
                    // remove-stake is checked below
                    'unstaking transactions must be set-active-stake, retire-stake, remove-stake (in order)',
                );
            }
            if (retireStakeData.retireStake > removeStakeTx.value + removeStakeTx.fee) {
                throw new Error('unstaking must not retire more than is being paid out');
            }

            // removeStake transaction
            // For removeStake, we don't have to check the following, which are checked by the Nimiq protocol
            // (statically or on commit) or earlier parsing steps above, or are displayed:
            // - sender (must be staking contract for outgoing staking transaction; enforced by protocol on commit)
            // - value (value + fee must be >= retired amount; checked above and displayed)
            // - total fees (must not exceed MAX_SAFE_INTEGER; checked above and displayed)
            // - validityStartHeight (must be in order and within the typical bounds; checked above and below)
            // - network id (must match Config.nimiqNetworkId; checked above)
            // - flags (must be none for transaction to basic account; enforced by protocol)
            // What must still be checked here: senderType, senderData, recipient, recipientType, recipientData

            // senderType and senderData
            const removeStakeData = parseOutgoingStakingTransactionData(removeStakeTx);
            if (!removeStakeData || removeStakeData.type !== 'remove-stake') {
                throw new Error(
                    // set-active-stake and retire-stake are checked above
                    'unstaking transactions must be set-active-stake, retire-stake, remove-stake (in order)',
                );
            }

            if (!removeStakeTx.recipient.equals(setActiveStakeTx.sender)) {
                // Enforce the payout address of the unstaked funds to be the same as the fee payer and the staking
                // address. This way, the transactions are easier for the user to interpret, and it is clear where the
                // funds are coming from and where they are going to. Note that this check is also what ties the payout
                // to the user's own address, preventing the unstaked NIM from being sent to an attacker via
                // benign-looking labels.
                throw new Error('unstaking transactions must payout to the fee payer and staker address');
            }

            if (removeStakeTx.recipientType !== Nimiq.AccountType.Basic) {
                throw new Error('unstaking transactions must not payout to a contract');
            }

            if (removeStakeTx.data.length) {
                // Disallow recipient data because we don't display it in the simplified unstaking flow.
                throw new Error('unstaking transactions must not have recipient data');
            }

            // Check validityStartHeights to be what is expected from the Wallet.
            const retireStakeDelay = retireStakeTx.validityStartHeight - setActiveStakeTx.validityStartHeight;
            if (retireStakeDelay <= Nimiq.Policy.BLOCKS_PER_EPOCH
                || retireStakeDelay > 2 * Nimiq.Policy.BLOCKS_PER_EPOCH) {
                throw new Error('unstaking retire-stake must start one to two epochs after set-active-stake');
            }
            if (removeStakeTx.validityStartHeight !== retireStakeTx.validityStartHeight + 1) {
                throw new Error('unstaking remove-stake must start one block after retire-stake');
            }

            parsed.senderLabel = parseLabel(unstakingRequest.senderLabel, 'senderLabel');
            // No recipientLabel: the payout recipient is the user's own address (enforced above), which a caller
            // must not be able to relabel; the Hub labels it from the user's account data.
            parsed.validatorAddress = parseAddress(unstakingRequest.validatorAddress, 'validatorAddress', false);
            if (unstakingRequest.validatorImageUrl) {
                parsed.validatorImageUrl = parseUrl(unstakingRequest.validatorImageUrl, 'validatorImageUrl');
            }
            break;
        }
        default:
            // Not expected to be reachable, as the layout was parsed by parseLayout, but makes sure that a layout
            // added in the future can not skip the layout-specific checks.
            throw new Error('Invalid selected layout');
    }

    return parsed;
}

/**
 * Inverse of parseSignTransactionRequest, for exporting the parsed request to the history state in RpcApi._exportState,
 * whose output is re-parsed by RequestParser.parse on reload.
 *
 * The request is always exported in the transactions-array byte format, also when it arrived in the legacy
 * single-transaction field format. Only values that survive both persistence channels (structured clone into
 * history.state, and JSONUtils' base64 encoding into sessionStorage) may be exported: plain strings, numbers and
 * Uint8Array - no class instances like Nimiq.Address or URL.
 */
export function rawSignTransactionRequest(request: ParsedSignTransactionRequest): SignTransactionRequest {
    const senderAddress = request.sender instanceof Nimiq.Address ? request.sender : request.sender.address;
    // Note: the additional information of the internal sender object form (RefundSwapLedger) is intentionally
    // lost and does not survive reloads, see ParsedSignTransactionRequest in RequestTypes.ts.
    const common = {
        appName: request.appName,
        sender: senderAddress.toUserFriendlyAddress(),
        senderLabel: request.senderLabel,
        transactions: request.transactions.map((tx) => tx.serialize()),
    };
    switch (request.layout) {
        case SignTransactionRequestLayout.SWITCH_VALIDATOR:
            return {
                ...common,
                layout: SignTransactionRequestLayout.SWITCH_VALIDATOR,
                recipientLabel: request.recipientLabel,
                // No validatorAddress: it is re-derived from the signed update-staker transaction's newDelegation
                // on re-parse.
                validatorImageUrl: request.validatorImageUrl ? request.validatorImageUrl.toString() : undefined,
                fromValidatorAddress: request.fromValidatorAddress!.toUserFriendlyAddress(),
                fromValidatorImageUrl: request.fromValidatorImageUrl
                    ? request.fromValidatorImageUrl.toString()
                    : undefined,
            };
        case SignTransactionRequestLayout.UNSTAKING:
            return {
                ...common,
                layout: SignTransactionRequestLayout.UNSTAKING,
                // No recipientLabel: for the unstaking layout it is not part of the public request, see
                // SignTransactionRequestUnstaking in PublicRequestTypes.ts.
                validatorAddress: request.validatorAddress!.toUserFriendlyAddress(),
                validatorImageUrl: request.validatorImageUrl ? request.validatorImageUrl.toString() : undefined,
            };
        case SignTransactionRequestLayout.STANDARD:
            return {
                ...common,
                layout: SignTransactionRequestLayout.STANDARD,
                recipientLabel: request.recipientLabel,
            };
        default:
            throw new Error('Invalid selected layout');
    }
}

/**
 * Hub-only, no Keyguard equivalent: applies the sender's account type resolved from the WalletStore to a request in
 * the legacy single-transaction object format. This legacy format can not specify the sender type, such that its parsed
 * transaction defaults to a basic sender as placeholder (see parseSignTransactionRequest), which this method replaces.
 */
export function patchLegacyRequestSenderType(
    request: ParsedSignTransactionRequest,
    actualSenderType: Nimiq.AccountType,
): void {
    // Only the standard layout with a single transaction can originate from the legacy format. The transactions of
    // all other requests are forwarded exactly as they were parsed.
    if (request.layout !== SignTransactionRequestLayout.STANDARD || request.transactions.length !== 1) return;
    const [transaction] = request.transactions;
    if (transaction.senderType !== Nimiq.AccountType.Basic // Preserve explicitly specified non-basic sender types.
        || actualSenderType === Nimiq.AccountType.Basic // Nothing to do if the actualSenderType is actually basic.
    ) return;

    // Note that the Nimiq.Transaction constructor automatically updates the correct contract creation
    // address for contract creations, overwriting the passed recipient in that case.
    request.transactions[0] = new Nimiq.Transaction(
        transaction.sender, actualSenderType, transaction.senderData,
        transaction.recipient, transaction.recipientType, transaction.data,
        transaction.value, transaction.fee,
        transaction.flags, transaction.validityStartHeight, transaction.networkId,
    );
}

/**
 * Checks that the given layout is valid.
 * Port of the Keyguard's SignTransactionApi.parseLayout.
 */
function parseLayout(layout: unknown): SignTransactionRequestLayout {
    if (!layout) {
        return SignTransactionRequestLayout.STANDARD;
    }
    if (!(Object.values(SignTransactionRequestLayout) as unknown[]).includes(layout)) {
        throw new Error('Invalid selected layout');
    }
    return layout as SignTransactionRequestLayout;
}

/**
 * Port of the Keyguard's RequestParser.parseTransaction, building a Nimiq.Transaction from a plain transaction
 * info object, with the following deviations:
 * - Entries don't include a sender address; the request-level sender is inherited (passed in as parameter).
 * - fee is optional in the Hub's public API and defaults to 0.
 * - The flags are additionally checked to be a single known flag
 * - contract address of contract creations is not re-derived after building the transaction, see below
 */
function parseTransaction(object: TransactionInfo, sender: Nimiq.Address): Nimiq.Transaction {
    if (!object || typeof object !== 'object') {
        throw new Error('Transaction info must be an object');
    }

    const accountTypes = new Set([
        Nimiq.AccountType.Basic,
        Nimiq.AccountType.Vesting,
        Nimiq.AccountType.HTLC,
        Nimiq.AccountType.Staking,
    ]);

    const senderType = object.senderType || Nimiq.AccountType.Basic;
    if (!accountTypes.has(senderType)) {
        throw new Error('Invalid sender type');
    }

    const senderData = typeof object.senderData === 'string'
        ? Utf8Tools.stringToUtf8ByteArray(object.senderData)
        : object.senderData || new Uint8Array(0);

    const recipient = parseAddress(object.recipient, 'recipient', true);
    const recipientType = object.recipientType || Nimiq.AccountType.Basic;
    if (!accountTypes.has(recipientType)) {
        throw new Error('Invalid recipient type');
    }

    const recipientData = typeof object.recipientData === 'string'
        ? Utf8Tools.stringToUtf8ByteArray(object.recipientData)
        : object.recipientData || new Uint8Array(0);

    const flags = object.flags || Nimiq.TransactionFlag.None;

    // Addition without a Keyguard counterpart: check the flags to be exactly one of the known flag values. The Keyguard
    // only compares them via === in the contract creation checks below, which lets flag combinations slip through while
    // Nimiq.Transaction turns them into a contract creation nonetheless.
    if (![Nimiq.TransactionFlag.None, Nimiq.TransactionFlag.ContractCreation, Nimiq.TransactionFlag.Signaling]
        .includes(flags)) {
        throw new Error('Combined flags are not supported for transaction entries');
    }

    if (
        flags === Nimiq.TransactionFlag.None
        && recipientType !== Nimiq.AccountType.Staking
        && recipientData.byteLength > 64
    ) {
        throw new Error('Data must not exceed 64 bytes');
    }
    if (
        flags === Nimiq.TransactionFlag.ContractCreation
        && recipientData.byteLength !== 82 // HTLC
        && recipientData.byteLength !== 28 // Vesting
        && recipientData.byteLength !== 44 // Vesting
        && recipientData.byteLength !== 52 // Vesting
    ) {
        throw new Error(
            'Contract creation data must be 82 bytes for HTLC and 28, 44, or 52 bytes for vesting contracts',
        );
    }
    if (flags === Nimiq.TransactionFlag.ContractCreation && recipient !== 'CONTRACT_CREATION') {
        throw new Error('Transaction recipient must be "CONTRACT_CREATION" when creating contracts');
    }
    // Addition without a Keyguard counterpart: reject the pseudo recipient without the contract creation flag, for
    // which the Keyguard is only covered by re-deriving the contract address for the pseudo recipient regardless of
    // the flags, which does not apply here (see below). Without this check, the placeholder address passed to
    // Nimiq.Transaction for the pseudo recipient would end up in the transaction as an actual recipient, sending the
    // funds to the burn address.
    if (recipient === 'CONTRACT_CREATION' && flags !== Nimiq.TransactionFlag.ContractCreation) {
        throw new Error('Transaction recipient can only be "CONTRACT_CREATION" when creating contracts');
    }

    try {
        // Deviation from the Keyguard, which builds contract creations with a zero placeholder recipient and then
        // recreates the transaction with the contract address derived as the transaction's hash: Nimiq.Transaction
        // already derives the contract address itself and replaces whatever recipient is passed with it.
        const tx = new Nimiq.Transaction(
            sender,
            senderType,
            senderData,
            recipient !== 'CONTRACT_CREATION' ? recipient : new Nimiq.Address(new Uint8Array(20)),
            recipientType,
            recipientData,
            BigInt(object.value),
            BigInt(object.fee || 0),
            flags,
            object.validityStartHeight,
            Config.nimiqNetworkId,
        );

        if (tx.sender.equals(tx.recipient)) {
            throw new Error('Sender and recipient must not match');
        }

        return tx;
    } catch (error) {
        throw new Error(error instanceof Error ? error.message : String(error));
    }
}

/**
 * Returns the parsed recipient data for an incoming staking transaction, or `undefined` if the transaction isn't
 * an incoming staking transaction.
 * Port of the Keyguard's SignTransactionApi._parseIncomingStakingTransactionData.
 */
function parseIncomingStakingTransactionData(tx: Nimiq.Transaction)
    : Nimiq.PlainTransactionRecipientData | undefined {
    if (tx.recipientType !== Nimiq.AccountType.Staking) return undefined;
    try {
        return Nimiq.StakingContract.dataToPlain(tx.data);
    } catch (e) {
        throw new Error('Invalid incoming staking transaction data');
    }
}

/**
 * Returns the parsed sender data for an outgoing staking transaction, or `undefined` if the transaction isn't an
 * outgoing staking transaction.
 * Port of the Keyguard's SignTransactionApi._parseOutgoingStakingTransactionData.
 */
function parseOutgoingStakingTransactionData(tx: Nimiq.Transaction): Nimiq.PlainTransactionSenderData | undefined {
    if (tx.senderType !== Nimiq.AccountType.Staking) return undefined;
    try {
        return tx.toPlain().senderData;
    } catch (e) {
        throw new Error('Invalid transaction or transaction data');
    }
}

/**
 * Detects whether an incoming staking transaction carries a filled-in staker / validator SignatureProof at the end of
 * its recipient data. TransactionBuilder produces these transactions with a zero-filled placeholder proof that
 * `transaction.sign()` later fills in using the outer keypair. If the trailing bytes already contain a non-zero proof,
 * we treat it as user-provided.
 *
 * Operations without an embedded proof (outgoing staking, `add-stake`) return false.
 * Throws for incoming staking transactions with invalid recipient data.
 *
 * Port of the Keyguard's SignTransactionApi._hasStakerOrValidatorProof.
 */
function hasStakerOrValidatorProof(tx: Nimiq.Transaction): boolean {
    const data = parseIncomingStakingTransactionData(tx); // validate and throw on invalid data
    if (!data) return false; // not an incoming staking transaction
    if (data.type === 'add-stake') return false; // add-stake has no embedded staking proof.

    const recipientData = tx.data; // tx.data is a getter; cache its result
    if (recipientData.length < Nimiq.SignatureProof.SINGLE_SIG_SIZE) return false;

    const proofStart = recipientData.length - Nimiq.SignatureProof.SINGLE_SIG_SIZE;
    for (let i = proofStart; i < recipientData.length; i++) {
        if (recipientData[i] !== 0) return true;
    }
    return false;
}

/**
 * Port of the Keyguard's RequestParser.parseLabel, without its allowEmpty parameter, as all Hub labels are optional.
 */
function parseLabel(label: unknown, parameterName: string = 'Label'): string | undefined {
    if (!label) {
        return undefined;
    }
    if (typeof label !== 'string') {
        throw new Error(`${parameterName} must be a string`);
    }
    if (Utf8Tools.stringToUtf8ByteArray(label).byteLength > LABEL_MAX_LENGTH) {
        throw new Error(`${parameterName} must not exceed ${LABEL_MAX_LENGTH} bytes`);
    }
    if (/[\x00-\x1F\x7F]/.test(label)) {
        throw new Error('Label cannot contain control characters');
    }
    return label;
}

/**
 * Port of the Keyguard's RequestParser.parseAddress, using Nimiq.Address.fromAny as is the convention in RequestParser,
 * instead of the Nimiq.Address constructor, which converts array-likes into an arbitrary address instead of rejecting
 * them, for example `{ length: 20 }` into the zero address.
 */
function parseAddress<T extends boolean>(address: unknown, name: string, allowContractCreation: T)
    : Nimiq.Address | (T extends true ? 'CONTRACT_CREATION' : never) {
    if (allowContractCreation && address === 'CONTRACT_CREATION') {
        return 'CONTRACT_CREATION' as (T extends true ? 'CONTRACT_CREATION' : never);
    }

    try {
        return Nimiq.Address.fromAny(address as Nimiq.Address | string | Uint8Array);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`${name} must be a valid Nimiq address (${errorMessage})`);
    }
}

/**
 * Port of the Keyguard's RequestParser._parseUrl, with an added try/catch around the URL constructor for a clean error
 * message.
 */
function parseUrl(url: string, parameterName: string): URL {
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
    } catch (e) {
        throw new Error(`${parameterName} must be a valid URL`);
    }
    const whitelistedProtocols = ['https:', 'http:', 'chrome-extension:', 'moz-extension:', 'data:'];
    if (!whitelistedProtocols.includes(parsedUrl.protocol)) {
        throw new Error(`${parameterName} protocol must be one of: ${whitelistedProtocols.join(', ')}`);
    }
    return parsedUrl;
}
