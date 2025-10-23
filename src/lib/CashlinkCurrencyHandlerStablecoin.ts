import Config from 'config';
import type { TypedDataField } from 'ethers';
import { TypedRequestData } from '@opengsn/common/dist/EIP712/TypedRequestData';
import { CashlinkCurrency } from '../../client/PublicRequestTypes';
import { ICashlinkCurrencyHandler, CashlinkTransaction } from './CashlinkCurrencyHandler';
import CashlinkInteractive from './CashlinkInteractive';
import {
    networkState,
    getPolygonClient,
    getPolygonBlockNumber,
    getUsdtBridgedBalance,
    calculateFee,
    getTransactionHistory,
    Transaction, createTransactionRequest, sendTransaction,
} from './polygon/ethers';
import { Key } from './polygon/signing/Key';
import { PolygonKey } from './polygon/signing/PolygonKey';
import { USDT_BRIDGED_TOKEN_CONTRACT_ABI, USDT_BRIDGED_TRANSFER_CONTRACT_ABI } from './polygon/ContractABIs';

export class CashlinkCurrencyHandlerStablecoin implements ICashlinkCurrencyHandler<CashlinkCurrency.USDT> {
    public readonly currency = CashlinkCurrency.USDT;
    private _chainTransactions: Transaction[] = []; // transactions already included on chain

    public constructor(public readonly cashlink: CashlinkInteractive<CashlinkCurrency.USDT>) {}

    public async awaitConsensus(): Promise<void> {
        if (networkState.consensus === 'established') return;
        const networkClient = await getPolygonClient();
        await new Promise<void>((resolve) => {
            networkClient.provider.once('block', resolve);
        });
    }

    public async getBlockchainHeight(): Promise<number> {
        return getPolygonBlockNumber();
    }

    public async getBalance(): Promise<number> {
        return getUsdtBridgedBalance(this.cashlink.address);
    }

    public async getFees(): Promise<number> {
        const feeInfo = await calculateFee(Config.polygon.usdt_bridged.tokenContract, 'transferWithPermit');
        return feeInfo.fee.toNumber();
    }

    public async getConfirmedTransactions(): Promise<CashlinkTransaction[]> {
        const networkClient = await getPolygonClient();
        const { usdtBridgedToken, usdtBridgedTransfer } = networkClient;
        const transactionHistory = await getTransactionHistory(
            this.cashlink.address,
            usdtBridgedToken,
            usdtBridgedTransfer,
            Config.polygon.usdt_bridged.earliestHistoryScanHeight,
            this._chainTransactions,
        )
        // Add new transactions and update previously known transactions, avoiding duplicates.
        this._chainTransactions = [...new Map([
            ...this._chainTransactions,
            ...transactionHistory,
        ].map((transaction) => [transaction.transactionHash, transaction])).values()]
            // Filter out transactions that are not included in the chain yet / anymore. This also handles previously
            // included transactions, which might not be included anymore due to rebranching.
            .filter((transaction) => transaction.state === 'mined' || transaction.state === 'confirmed');
        // Convert to simplified CashlinkTransactions
        return this._chainTransactions.map((tx) => this._transactionToSimplifiedCashlinkTransaction(tx));
    }

    public async getPendingTransactions(): Promise<CashlinkTransaction[]> {

    }

    public async registerTransactionListener(onTransactionAddedOrUpdated: (transaction: CashlinkTransaction) => void)
        : Promise</* unregister */ () => void> {

    }

    public async getCashlinkFundingDetails(): Promise<{

    }> {

    }

    public async claimCashlink(recipient: string): Promise<CashlinkTransaction> {
        const entropy = new Nimiq.Entropy(this.cashlink.secret);
        const key = new Key(entropy);
        const polygonKey = new PolygonKey(key);

        const fromAddress = polygonKey.deriveAddress('m');

        const [networkClient, txrequest] = await Promise.all([
            getPolygonClient(),
            createTransactionRequest(
                Config.polygon.usdt_bridged.tokenContract,
                fromAddress,
                recipient,
                this.cashlink.claimableAmount,
            ),
        ]);
        const ethers = networkClient.ethers;

        const cashlinkContract = new ethers.Contract(
            Config.polygon.usdt_bridged.cashlinkContract,
            USDT_BRIDGED_TRANSFER_CONTRACT_ABI,
            networkClient.provider,
        );

        // Decode the request description
        const description = cashlinkContract.interface.parseTransaction({
            data: txrequest.relayRequest.request.data,
            value: txrequest.relayRequest.request.value,
        });

        // Sign approval for the necessary amount
        const { sigR, sigS, sigV } = await polygonKey.signUsdtApproval(
            'm',
            new ethers.Contract(
                Config.polygon.usdt_bridged.tokenContract,
                USDT_BRIDGED_TOKEN_CONTRACT_ABI,
            ),
            Config.polygon.usdt_bridged.cashlinkContract,
            description.args.approval,
            txrequest.approval.tokenNonce,
            fromAddress,
        );

        // Add approval signature into tx data
        txrequest.relayRequest.request.data = cashlinkContract.interface.encodeFunctionData(description.name, [
            /* address token */ description.args.token,
            /* uint256 amount */ description.args.amount,
            /* address pool */ description.args.pool,
            /* uint256 targetAmount */ description.args.targetAmount,
            /* uint256 fee */ description.args.fee,
            /* uint256 approval */ description.args.approval,
            /* bytes32 sigR */ sigR,
            /* bytes32 sigS */ sigS,
            /* uint8 sigV */ sigV,
        ]);

        const typedData = new TypedRequestData(
            Config.polygon.networkId,
            Config.polygon.usdt_bridged.cashlinkContract,
            txrequest.relayRequest,
        );

        const { EIP712Domain, ...cleanedTypes } = typedData.types;

        // Sign the relay request
        const signature = await polygonKey.signTypedData(
            'm',
            typedData.domain,
            cleanedTypes as unknown as Record<string, TypedDataField[]>,
            typedData.message,
        );

        const transaction = await sendTransaction(
            Config.polygon.usdt_bridged.tokenContract,
            txrequest.relayRequest,
            signature,
            txrequest.relay.url,
        );

        return this._transactionToSimplifiedCashlinkTransaction(transaction);
    }

    private _transactionToSimplifiedCashlinkTransaction(transaction: Transaction)
        : CashlinkTransaction {
        return {
            transactionHash: transaction.transactionHash,
            sender: transaction.sender,
            recipient: transaction.recipient,
            value: transaction.value,
            fee: transaction.fee || 0,
            state: ({
                new: 'pending',
                pending: 'pending',
                mined: 'confirmed',
                confirmed: 'confirmed',
                failed: 'expired',
                expired: 'expired',
            } as const)[transaction.state],
        };
    }
}
