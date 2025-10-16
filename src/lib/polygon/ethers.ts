/* eslint-disable no-console */
import type { BigNumber, Contract, ethers, Event, EventFilter, providers } from 'ethers';
import type { Result } from 'ethers/lib/utils';
// eslint-disable-next-line import/no-extraneous-dependencies
import type { Block, Log, TransactionReceipt } from '@ethersproject/abstract-provider';
import type { RelayRequest } from '@opengsn/common/dist/EIP712/RelayRequest';
import Config from 'config';
import { POLYGON_NETWORK_MAIN } from './PolygonConstants';
import {
    USDC_TOKEN_CONTRACT_ABI,
    USDC_TRANSFER_CONTRACT_ABI,
    USDT_BRIDGED_TOKEN_CONTRACT_ABI,
    USDT_BRIDGED_TRANSFER_CONTRACT_ABI,
} from './ContractABIs';
import {
    getHttpClient as getOpenGsnHttpClient,
    getBestRelay,
    getRelayAddr,
    getRelayHub,
    POLYGON_BLOCKS_PER_MINUTE,
    RelayServerInfo,
} from './OpenGSN';
import { getPoolAddress, getUsdPrice } from './Uniswap';
import { replaceKey } from '../KeyReplacer';

export type Transaction = {
    token?: string,
    transactionHash: string,
    logIndex: number,
    sender: string,
    recipient: string,
    value: number,
    fee?: number,
    // event?: HtlcEvent | UniswapEvent,
    state: TransactionState,
    blockHeight?: number,
    timestamp?: number,
};

export enum TransactionState {
    NEW = 'new',
    PENDING = 'pending',
    MINED = 'mined',
    FAILED = 'failed',
    EXPIRED = 'expired',
    CONFIRMED = 'confirmed',
}

export async function loadEthersLibrary() {
    return import(/* webpackChunkName: "ethers-js" */ 'ethers');
}

export interface PolygonClient {
    provider: providers.Provider;
    usdcToken: Contract;
    usdcTransfer: Contract;
    usdtBridgedToken: Contract;
    usdtBridgedTransfer: Contract;
    ethers: typeof ethers;
}

// TODO fire events on change
const networkState: {
    consensus: 'connecting' | 'syncing' | 'established',
    outdatedHeight: number,
} = {
    consensus: 'connecting',
    outdatedHeight: 0,
};

function consensusEstablishedHandler(height: number) {
    networkState.outdatedHeight = height;
    console.log('Polygon connection established');
    networkState.consensus = 'established';
}

function onTransaction(transaction: Transaction) {
    // TODO fire an event
}

let clientPromise: Promise<PolygonClient> | null = null;
export async function getPolygonClient(): Promise<PolygonClient> {
    if (clientPromise) return clientPromise;

    let resolver: (client: PolygonClient) => void;
    clientPromise = new Promise<PolygonClient>((resolve) => {
        resolver = resolve;
    });

    let provider: providers.BaseProvider;
    const [ethers, rpcEndpoint] = await Promise.all([
        loadEthersLibrary(),
        replaceKey(Config.polygon.rpcEndpoint),
    ]);
    if (rpcEndpoint.substring(0, 4) === 'http') {
        provider = new ethers.providers.StaticJsonRpcProvider(
            rpcEndpoint,
            ethers.providers.getNetwork(Config.polygon.networkId),
        );
    } else if (rpcEndpoint.substring(0, 2) === 'ws') {
        // No need to optimize this import as it's the ethers-js chunk which is already loaded via loadEthersLibrary.
        const SturdyWebsocket = (await import(/* webpackChunkName: "ethers-js" */ 'sturdy-websocket')).default;
        const socket = new SturdyWebsocket(rpcEndpoint, {
            debug: true,
        });
        socket.addEventListener('down', () => {
            console.log('Polygon connection lost');
            networkState.consensus = 'connecting';
        });
        socket.addEventListener('reopen', async () => {
            networkState.consensus = 'syncing';
            const client = await getPolygonClient();
            client.provider.once('block', consensusEstablishedHandler);
        });
        provider = new ethers.providers.WebSocketProvider(
            socket,
            ethers.providers.getNetwork(Config.polygon.networkId),
        );
    } else {
        throw new Error('Invalid RPC endpoint URL');
    }

    await provider.ready;

    // Wait for a block event to make sure we are really connected
    await new Promise<void>((resolve) => {
        provider.once('block', (height: number) => {
            consensusEstablishedHandler(height);
            resolve();
        });
    });

    const usdcToken = new ethers.Contract(
        Config.polygon.usdc.tokenContract, USDC_TOKEN_CONTRACT_ABI, provider);
    const usdcTransfer = new ethers.Contract(
        Config.polygon.usdc.transferContract, USDC_TRANSFER_CONTRACT_ABI, provider);

    const usdtBridgedToken = new ethers.Contract(
        Config.polygon.usdt_bridged.tokenContract, USDT_BRIDGED_TOKEN_CONTRACT_ABI, provider);
    const usdtBridgedTransfer = new ethers.Contract(
        Config.polygon.usdt_bridged.transferContract, USDT_BRIDGED_TRANSFER_CONTRACT_ABI, provider);

    resolver!({
        provider,
        usdcToken,
        usdcTransfer,
        usdtBridgedToken,
        usdtBridgedTransfer,
        ethers,
    });

    return clientPromise;
}

export async function getUsdcBalance(address: string) {
    const client = await getPolygonClient();
    const balance = await client.usdcToken.balanceOf(address) as BigNumber;
    return balance.toNumber(); // With Javascript numbers we can represent up to 9,007,199,254 USDC, enough for now
}

export async function getUsdtBridgedBalance(address: string) {
    const client = await getPolygonClient();
    const balance = await client.usdtBridgedToken.balanceOf(address) as BigNumber;
    return balance.toNumber(); // With Javascript numbers we can represent up to 9,007,199,254 USDT, enough for now
}

// Safely queries logs over a block range, dynamically reducing the range if a provider error occurs.
export async function safeQueryFilter(
    contract: Contract,
    event: EventFilter | string,
    fromBlock: number,
    toBlock: number,
): Promise<Array<Event>> {
    const allEvents: Event[] = [];
    // https://www.alchemy.com/docs/deep-dive-into-eth_getlogs#eth_getlogs-example
    const NO_LOG_LIMIT_BLOCK_RANGE = 2000;
    let currentStart = fromBlock;
    let currentEnd = toBlock;
    let currentRange = currentEnd - currentStart;

    // Loop until we’ve queried the full range of blocks, retries upon failures.
    // If the request with the original params fails, any subsequent requests will
    // have a block range <= `MAX_RECOMMENDED_RANGE`.
    // 1st try - queries with the given block range
    // 2nd try - uses the max recommended range
    // Subsequent tries halve the range until success or minimum range reached.
    while (currentEnd <= toBlock) {
        // Attempt to fetch logs in the current range.
        // Reduce the window size until it no longer exceeds alchemy's limits.
        while (true) { // eslint-disable-line no-constant-condition
            try {
                // eslint-disable-next-line no-await-in-loop
                const eventsChunk = await contract.queryFilter(event, currentStart, currentEnd);
                allEvents.push(...eventsChunk);
                break;
            } catch (err) {
                // Fail if minimum range is reached.
                if (currentRange <= NO_LOG_LIMIT_BLOCK_RANGE) {
                    // eslint-disable-next-line
                    console.error('Query filter failed within the no-limit range, giving up.', currentStart, currentEnd, err);
                    throw err;
                }
                // Otherwise halve the range and retry.
                currentRange = Math.floor(currentRange / 2);
                currentEnd = currentStart + currentRange;
                console.warn(
                    'Query filter failed. '
                    + `Retrying with a halved range of ${currentRange}, from ${currentStart}, to ${currentEnd}`,
                    err,
                );
            }
        }

        // Move the window forward.
        currentStart = currentEnd + 1;
        // Ensures subsequent requests follow the latest accepted range.
        currentEnd = currentStart + currentRange;
    }

    return allEvents;
}

const subscribedAddresses = new Set<string>();

let currentUsdcSubscriptionFilter: EventFilter | undefined;
let currentUsdtBridgedSubscriptionFilter: EventFilter | undefined;
function subscribe(addresses: string[]) {
    getPolygonClient().then((client) => {
        // Only subscribe to incoming logs
        // TODO track outgoing transfers, too. See launchPolygon for syntax.
        // TODO add addresses to subscribedAddresses
        const newUsdcFilterIncoming = client.usdcToken.filters.Transfer(null, [...subscribedAddresses]);
        client.usdcToken.on(newUsdcFilterIncoming, transactionListener);
        if (currentUsdcSubscriptionFilter) {
            client.usdcToken.off(currentUsdcSubscriptionFilter, transactionListener);
        }
        currentUsdcSubscriptionFilter = newUsdcFilterIncoming;

        const newUsdtBridgedFilterIncoming = client.usdtBridgedToken.filters.Transfer(null, [...subscribedAddresses]);
        client.usdtBridgedToken.on(newUsdtBridgedFilterIncoming, transactionListener);
        if (currentUsdtBridgedSubscriptionFilter) {
            client.usdtBridgedToken.off(currentUsdtBridgedSubscriptionFilter, transactionListener);
        }
        currentUsdtBridgedSubscriptionFilter = newUsdtBridgedFilterIncoming;
    });
}

// Is only called for incoming transfers
// TODO track outgoing transfers, too. Same for USDT
// TODO check the transferContract to be the Cashlink contract; take inspiration from HTLC handling in Wallet's
//  usdcTransactionListener and receiptToTransaction.
async function transactionListener(from: string, to: string, value: BigNumber, log: TransferEvent) {
    if (!subscribedAddresses.has(from) && !subscribedAddresses.has(to)) return;
    if (value.isZero()) return; // Ignore address poisoning scam transactions

    const block = await log.getBlock();
    const tx = logAndBlockToPlain(log, block);

    onTransaction(tx);
}

export async function getTransactionHistory(
    address: string,
    tokenContract: Contract,
    transferContract: Contract,
    // earliestHistoryScanHeight and knownTxs are recommended to set to reduce the search scope.
    earliestHistoryScanHeight: number = 0,
    knownTxs: Transaction[] = [], // known confirmed transactions for address on tokenContract
): Promise<Transaction[]> {
    const lastConfirmedHeight = knownTxs
        .filter((tx) => Boolean(tx.blockHeight))
        .reduce((maxHeight, tx) => Math.max(tx.blockHeight!, maxHeight), 0);
    const earliestHeightToCheck = Math.max(
        earliestHistoryScanHeight,
        lastConfirmedHeight - 1000,
    );

    const [ethers, poolAddress] = await Promise.all([
        loadEthersLibrary(),
        getPoolAddress(transferContract, tokenContract.address),
    ]);

    let result: Transaction[] = [];

    const logPrefix = `Fetching stablecoin history for ${address} on contract ${tokenContract.address}:`;
    console.debug(logPrefix, 'start');

    // EventFilters only allow to query with an AND condition between arguments (topics). So while
    // we could specify an array of parameters to match for each topic (which are OR'd), we cannot
    // OR two AND pairs. That requires two separate requests.
    const filterIncoming = tokenContract.filters.Transfer(null, address);
    const filterOutgoing = tokenContract.filters.Transfer(address);

    const STEP_BLOCKS = Config.polygon.rpcMaxBlockRange;

    const MAX_ALLOWANCE = ethers.BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    // The minimum allowance that should remain so we can be certain the max allowance was ever given.
    // If the current allowance is below this number, we ignore allowance counting for the history sync.
    const MIN_ALLOWANCE = ethers.BigNumber.from('0x1000000000000000000000000000000000000000000000000000000000000000');

    const getNonce = 'nonces' in tokenContract ? tokenContract.nonces : tokenContract.getNonce;
    let [balance, nonce, transferAllowanceUsed, blockHeight] = await Promise.all([
        tokenContract.balanceOf(address) as Promise<BigNumber>,
        getNonce(address).then((nonce: BigNumber) => nonce.toNumber()) as Promise<number>,
        tokenContract.allowance(address, transferContract.address)
            .then((allowance: BigNumber) => {
                if (allowance.lt(MIN_ALLOWANCE)) return ethers.BigNumber.from(0);
                return MAX_ALLOWANCE.sub(allowance);
            }) as Promise<BigNumber>,
        getPolygonBlockNumber(),
    ]);

    // To filter known txs
    const knownHashes = knownTxs.map(
        (tx) => tx.transactionHash,
    );

    // Iterate transaction history backwards, simulating prior balance, nonce and transfer allowance, to find a suitable
    // spot where to stop the history fetching.
    while (blockHeight > earliestHeightToCheck && (
        balance.gt(0)
        || nonce > 0
        || transferAllowanceUsed.gt(0)
    )) {
        const startHeight = Math.max(blockHeight - STEP_BLOCKS, earliestHeightToCheck);
        const endHeight = blockHeight;
        blockHeight = startHeight;

        console.debug(logPrefix, 'new chunk; simulated balance, nonce and allowance at the end:', {
            balance: balance.toNumber() / 1e6,
            nonce,
            transferAllowance: transferAllowanceUsed.toNumber() / 1e6,
        });

        console.debug(logPrefix, `querying logs from ${startHeight} to ${endHeight} = ${endHeight - startHeight}`);

        let [logsIn, logsOut] = await Promise.all([ // eslint-disable-line no-await-in-loop
            safeQueryFilter(tokenContract, filterIncoming, startHeight, endHeight),
            safeQueryFilter(tokenContract, filterOutgoing, startHeight, endHeight),
        ]);

        // Ignore address poisoning transactions
        logsIn = logsIn.filter((log) => !!log.args && !(log.args.value as BigNumber).isZero());
        logsOut = logsOut.filter((log) => !!log.args && !(log.args.value as BigNumber).isZero());

        console.debug(logPrefix, `got ${logsIn.length} incoming and ${logsOut.length} outgoing logs`);

        // TODO: When switching to use max-approval, only reduce nonce once the allowances are 0
        const outgoingTxs = new Set(logsOut.map((ev) => ev.transactionHash));
        console.debug(logPrefix, `found ${outgoingTxs.size} outgoing txs`);
        nonce -= outgoingTxs.size; // Simulate previous nonce.

        const allTransferLogs = logsIn.concat(logsOut) as TransferEvent[];

        const newLogs = allTransferLogs.filter((log) => {
            // Simulate previous balance and allowance before this transaction was performed.
            // TODO: When switching to use max-approval, remove nonce <= 0 check, so allowances get reduced first
            if (log.args.from === address && nonce <= 0) {
                balance = balance.add(log.args.value);
                transferAllowanceUsed = transferAllowanceUsed.sub(log.args.value);
            }
            if (log.args.to === address) {
                balance = balance.sub(log.args.value);
            }

            if (knownHashes.includes(log.transactionHash)) return false;

            // Transfers to the Uniswap pool are the fees paid to OpenGSN
            if (log.args.to === poolAddress) {
                // Find the main transfer log
                const mainTransferLog = allTransferLogs.find((otherLog) =>
                    otherLog.transactionHash === log.transactionHash
                    && otherLog.logIndex !== log.logIndex);

                if (!mainTransferLog) {
                    // If no main transfer log was found, it means this transaction failed
                    // and only the fee was paid.
                    log.failed = true;
                    return true;
                }

                // Write this log's `value` as the main transfer log's `fee`
                mainTransferLog.args = addFeeToArgs(mainTransferLog.args, log.args.value);
                // Then ignore this log
                return false;
            }

            return true;
        });

        const logsAndBlocks = newLogs.map((log) => ({
            log,
            block: log.getBlock(),
        }));

        // TODO: Allow individual fetches to fail, but still add the other transactions?
        const transactions = await Promise.all(logsAndBlocks.map( // eslint-disable-line no-await-in-loop
            async ({ log, block }) => logAndBlockToPlain(
                log,
                await block,
            ),
        ));
        result = transactions.concat(result);
    } // End while loop

    console.debug(logPrefix, 'fetching transaction history done, final simulated balance, nonce and allowance:', {
        balance: balance.toNumber() / 1e6,
        nonce,
        transferAllowance: transferAllowanceUsed.toNumber() / 1e6,
    });

    return result;
}

function logAndBlockToPlain(
    log: TransferEvent | TransferLog,
    block?: Block,
    // event?: HtlcEvent | UniswapEvent,
): Transaction {
    return {
        token: log.address,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        sender: log.args.from,
        recipient: log.args.to,
        value: log.args.value.toNumber(), // With Javascript numbers we can safely represent up to 9,007,199,254 USDC/T
        fee: log.args.fee?.toNumber(),
        // event,
        state: log.failed
            ? TransactionState.FAILED
            : (block ? TransactionState.MINED : TransactionState.PENDING),
        blockHeight: block?.number,
        timestamp: block?.timestamp,
    };
}

type ContractMethods =
    'transfer'
    | 'transferWithPermit'
    | 'transferWithApproval'
    | 'open'
    | 'openWithPermit'
    | 'openWithApproval'
    | 'redeemWithSecretInData'
    | 'refund'
    // | 'swap'
    | 'swapWithApproval';

export async function calculateFee(
    token: string, // Contract address
    method: ContractMethods,
    forceRelay?: RelayServerInfo,
    contract?: Contract,
) {
    const client = await getPolygonClient();
    if (!contract) {
        if (token === Config.polygon.usdc.tokenContract) contract = client.usdcTransfer;
        else if (token === Config.polygon.usdt_bridged.tokenContract) contract = client.usdtBridgedTransfer;
        else throw new Error(`No transfer contract available for token ${token}`);
    }

    // The byte size of `data` of the wrapper relay transaction, plus 4 bytes for the `relayCall` method identifier
    const dataSize = {
        transfer: 1092,
        transferWithPermit: 1220,
        transferWithApproval: 1220,
        open: 1220,
        openWithPermit: 1348, // TODO: Recheck this value
        openWithApproval: 1348, // TODO: Recheck this value
        redeemWithSecretInData: 1092,
        refund: 1092,
        // swap: 0,
        swapWithApproval: 1252,
    }[method];

    if (!dataSize) throw new Error(`No dataSize set yet for ${method} method!`);

    // Update minGasPrice if relay was forcedRelay, as it is most likely outdated.
    // Also checks for `ready` status to avoid retrying with a non-ready relay
    let relay = await (forceRelay
        ? getRelayAddr(forceRelay.url).then((addr) => {
            if (!addr || !addr.ready) return undefined;
            return <RelayServerInfo>{
                ...forceRelay,
                minGasPrice: client.ethers.BigNumber.from(addr.minGasPrice),
            };
        })
        : Promise.resolve(undefined)
    );

    const [
        networkGasPrice,
        gasLimit,
        [acceptanceBudget],
        dataGasCost,
        usdPrice,
    ] = await Promise.all([
        client.provider.getGasPrice(),
        contract.getRequiredRelayGas(contract.interface.getSighash(method)) as Promise<BigNumber>,
        relay
            ? Promise.resolve([client.ethers.BigNumber.from(0)])
            : contract.getGasAndDataLimits() as Promise<[BigNumber, BigNumber, BigNumber, BigNumber]>,
        relay
            ? Promise.resolve(client.ethers.BigNumber.from(0))
            : getRelayHub(client).calldataGasCost(dataSize) as Promise<BigNumber>,
        getUsdPrice(token, client),
    ]);

    function calculateChainTokenFee(baseRelayFee: BigNumber, pctRelayFee: BigNumber, minGasPrice: BigNumber) {
        let gasPrice = networkGasPrice.gte(minGasPrice) ? networkGasPrice : minGasPrice;

        // For swap redeem txs, add 50% to cover network fee changes until the end of the swap.
        // Otherwise, in mainnet, add 10%; in testnet add 25% as it is more volatile.
        const gasPriceBufferPercentage = method === 'redeemWithSecretInData'
            ? 150
            : Config.polygon.network === POLYGON_NETWORK_MAIN ? 110 : 125;
        gasPrice = gasPrice.mul(gasPriceBufferPercentage).div(100);

        // (gasPrice * gasLimit) * (1 + pctRelayFee) + baseRelayFee
        const chainTokenFee = gasPrice.mul(gasLimit).mul(pctRelayFee.add(100)).div(100).add(baseRelayFee);

        return { gasPrice, chainTokenFee };
    }

    if (!relay) {
        const requiredMaxAcceptanceBudget = acceptanceBudget.add(dataGasCost);
        relay = await getBestRelay(client, requiredMaxAcceptanceBudget, calculateChainTokenFee);
    }

    const { baseRelayFee, pctRelayFee, minGasPrice } = relay;

    const { gasPrice, chainTokenFee } = calculateChainTokenFee(baseRelayFee, pctRelayFee, minGasPrice);

    // main 10%, test 25% as it is more volatile
    const uniswapBufferPercentage = Config.polygon.network === POLYGON_NETWORK_MAIN ? 110 : 125;
    const fee = chainTokenFee.div(usdPrice).mul(uniswapBufferPercentage).div(100);

    return {
        chainTokenFee,
        fee,
        gasPrice,
        gasLimit,
        relay,
        usdPrice,
    };
}

export async function createTransactionRequest(
    tokenAddress: string,
    fromAddress: string,
    recipient: string,
    amount: number,
    forceRelay?: RelayServerInfo,
) {
    const client = await getPolygonClient();

    const tokenContract = tokenAddress === Config.polygon.usdc.tokenContract
        ? client.usdcToken
        : client.usdtBridgedToken;
    const transferAddress = tokenAddress === Config.polygon.usdc.tokenContract
        ? Config.polygon.usdc.transferContract
        : Config.polygon.usdt_bridged.transferContract;
    const transferContract = tokenAddress === Config.polygon.usdc.tokenContract
        ? client.usdcTransfer
        : client.usdtBridgedTransfer;

    type Methods = 'transfer' | 'transferWithPermit' | 'transferWithApproval';
    const method: Methods = tokenAddress === Config.polygon.usdc.tokenContract
        ? 'transferWithPermit'
        : 'transferWithApproval';

    // // This sets the fee buffer to 10 USDC, which should be enough.
    // method = usdcAllowance.gte(amount + 10e6) ? 'transfer' : method;

    const [
        nonce,
        // usdcAllowance,
        forwarderNonce,
        { fee, gasPrice, gasLimit, relay },
        balance,
    ] = await Promise.all([
        ('nonces' in tokenContract
            ? tokenContract.nonces(fromAddress)
            : tokenContract.getNonce(fromAddress)
        ) as Promise<BigNumber>,
        // tokenContract.allowance(fromAddress, transferAddress) as Promise<BigNumber>,
        transferContract.getNonce(fromAddress) as Promise<BigNumber>,
        calculateFee(tokenAddress, method, forceRelay),
        tokenAddress === Config.polygon.usdc.tokenContract
            ? getUsdcBalance(fromAddress)
            : getUsdtBridgedBalance(fromAddress),
    ]);

    // Ensure we send only what's possible with the updated fee
    amount = Math.min(amount, (balance || 0) - fee.toNumber());

    // // To be safe, we still check that amount + fee fits into the current allowance
    // if (method === 'transfer' && usdcAllowance.lt(fee.add(amount))) {
    //     throw new Error('Unexpectedly high fee, not enough allowance on the USDC contract');
    // }

    const data = transferContract.interface.encodeFunctionData(method, [
        /* address token */ tokenAddress,
        /* uint256 amount */ amount,
        /* address target */ recipient,
        /* uint256 fee */ fee,
        ...(method === 'transferWithPermit' || method === 'transferWithApproval' ? [
            // // Approve the maximum possible amount so afterwards we can use the `transfer` method for lower fees
            // /* uint256 value/approval */ client.ethers
            //     .BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
            /* uint256 value/approval */ fee.add(amount),

            // Dummy values, replaced by real signature bytes in Keyguard
            /* bytes32 sigR */ '0x0000000000000000000000000000000000000000000000000000000000000000',
            /* bytes32 sigS */ '0x0000000000000000000000000000000000000000000000000000000000000000',
            /* uint8 sigV */ 0,
        ] : []),
    ]);

    const relayRequest: RelayRequest = {
        request: {
            from: fromAddress,
            to: transferAddress,
            data,
            value: '0',
            nonce: forwarderNonce.toString(),
            gas: gasLimit.toString(),
            validUntil: (await getPolygonBlockNumber() + 2 * 60 * POLYGON_BLOCKS_PER_MINUTE) // 2 hours
                .toString(10),
        },
        relayData: {
            gasPrice: gasPrice.toString(),
            pctRelayFee: relay.pctRelayFee.toString(),
            baseRelayFee: relay.baseRelayFee.toString(),
            relayWorker: relay.relayWorkerAddress,
            paymaster: transferAddress,
            paymasterData: '0x',
            clientId: Math.floor(Math.random() * 1e6).toString(10),
            forwarder: transferAddress,
        },
    };

    return {
        relayRequest,
        relay: {
            url: relay.url,
        },
        ...(method === 'transferWithPermit' ? {
            permit: {
                tokenNonce: nonce.toNumber(),
            },
        } : null),
        ...(method === 'transferWithApproval' ? {
            approval: {
                tokenNonce: nonce.toNumber(),
            },
        } : null),
    };
}

export async function sendTransaction(
    token: string,
    relayRequest: RelayRequest,
    signature: string,
    relayUrl: string,
) {
    const client = await getPolygonClient();

    const [httpClient, relayNonce] = await Promise.all([
        getOpenGsnHttpClient(),
        client.provider.getTransactionCount(relayRequest.relayData.relayWorker),
    ]);

    const relayNonceMaxGap = Config.polygon.network === POLYGON_NETWORK_MAIN ? 3 : 5;

    const relayTx = await httpClient.relayTransaction(relayUrl, {
        relayRequest,
        metadata: {
            approvalData: '0x', // HTLC redeem approval
            relayHubAddress: Config.polygon.openGsnRelayHubContract,
            relayMaxNonce: relayNonce + relayNonceMaxGap,
            signature,
        },
    });

    // TODO: Audit and validate transaction like in
    // https://github.com/opengsn/gsn/blob/v2.2.5/packages/provider/src/RelayClient.ts#L270

    let txResponse = await client.provider.sendTransaction(relayTx)
        .catch((error) => {
            console.debug('Failed to also send relay transaction:', error);
        });

    while (!txResponse) {
        const tx = client.ethers.utils.parseTransaction(relayTx);
        // eslint-disable-next-line no-await-in-loop
        txResponse = await client.provider.getTransaction(tx.hash!);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => { setTimeout(resolve, 1000); });
    }

    const tx = await receiptToTransaction(
        token,
        await txResponse.wait(1),
        // Do not filter by sender for incoming txs
        // TODO adapt
        // isIncomingTx ? undefined : relayRequest.request.from,
    );

    return tx;
}

export async function receiptToTransaction(
    token: string,
    receipt: TransactionReceipt,
    filterByFromAddress?: string,
    block?: providers.Block,
) {
    const client = await getPolygonClient();

    const [tokenContract, transferContract] = token === Config.polygon.usdc.tokenContract
        ? [client.usdcToken, client.usdcTransfer]
        : [client.usdtBridgedToken, client.usdtBridgedTransfer];

    const poolAddress = await getPoolAddress(transferContract, token);

    const logs = receipt.logs.map((log) => {
        if (log.address === token) {
            try {
                const { args, name } = tokenContract.interface.parseLog(log);
                return {
                    ...log,
                    args,
                    name,
                };
            } catch (error) {
                return null;
            }
        }

        return null;
    });

    let transferLog: TransferLog | undefined;
    let feeLog: TransferLog | undefined;

    logs.forEach((log) => {
        if (!log) return;

        if (log.name === 'Transfer') {
            if (filterByFromAddress && log.args.from !== filterByFromAddress) return;

            // Transfers to the Uniswap pool are the fees paid to OpenGSN
            if (log.args.to === poolAddress) {
                feeLog = log as TransferLog;
                return;
            }

            transferLog = log as TransferLog;
            return;
        }
    });

    if (!transferLog) {
        if (feeLog) {
            transferLog = feeLog;
            transferLog.failed = true;
            feeLog = undefined;
        } else {
            throw new Error('Could not find transfer log');
        }
    }

    if (feeLog) {
        transferLog.args = addFeeToArgs(transferLog.args, feeLog.args.value);
    }

    return logAndBlockToPlain(
        transferLog,
        block || await client.provider.getBlock(transferLog.blockHash),
    );
}

export async function getPolygonBlockNumber() {
    const client = await getPolygonClient();
    const blockNumber = await client.provider.getBlockNumber();
    networkState.outdatedHeight = blockNumber;
    return blockNumber;
}

function addFeeToArgs<T extends Result>(readonlyArgs: T, fee: BigNumber): T {
    // Clone args as writeable
    type Writeable<T> = { -readonly [P in keyof T]: T[P] };
    const args = [...readonlyArgs] as Writeable<Result>;
    args.from = args[0];
    args.to = args[1];
    args.value = args[2];

    // Add the fee
    args.push(fee);
    args.fee = args[3]; // eslint-disable-line prefer-destructuring

    return Object.freeze(args) as T;
}

// @ts-ignore - just for debugging
window.gimmePolygonClient = async () => getPolygonClient();

interface TransferResult extends ReadonlyArray<any> {
    0: string;
    1: string;
    2: BigNumber;
    3?: BigNumber;
    from: string;
    to: string;
    value: BigNumber;
    fee?: BigNumber;
}

interface TransferLog extends Log {
    args: TransferResult;
    name: string;
    failed?: boolean;
}

interface TransferEvent extends Event {
    args: TransferResult;
    failed?: boolean;
}
