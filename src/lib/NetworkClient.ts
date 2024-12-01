import Config from 'config';
import { NETWORK_TEST, NETWORK_MAIN, NETWORK_DEV, ERROR_INVALID_NETWORK } from './Constants';

export class NetworkClient {
    private static _instance?: NetworkClient;

    public static get Instance() {
        return this._instance || (this._instance = new NetworkClient());
    }

    private _clientPromise?: Promise<Nimiq.Client>;

    // constructor() {}

    public async init() {
        const initPromise = this._clientPromise || (this._clientPromise = new Promise(async (resolve) => {
            const clientConfig = new Nimiq.ClientConfiguration();
            clientConfig.network(this.networkToAlbatross(Config.network));
            clientConfig.seedNodes(Config.seedNodes);
            clientConfig.logLevel('debug');
            resolve(Nimiq.Client.create(clientConfig.build()));
        }));

        await initPromise;
    }

    public async requestTransactionReceipts(address: string, limit?: number) {
        const client = await this.client;
        // Require only one history peer when not in mainnet
        const minPeers = Config.network === NETWORK_MAIN ? undefined : 1;
        return client.getTransactionReceiptsByAddress(address, limit, /* startAt */ undefined, minPeers);
    }

    public async getTransactionsByAddress(
        address: string | Nimiq.Address,
        // sinceBlockHeight?: number,
        knownTransactionDetails?: Nimiq.PlainTransactionDetails[],
        // startAt?: string,
        limit?: number,
        // minPeers?: number,
    ) {
        const client = await this.client;
        // Require only one history peer when not in mainnet
        const minPeers = Config.network === NETWORK_MAIN ? undefined : 1;
        return client.getTransactionsByAddress(
            address,
            undefined /* sinceBlockHeight */,
            knownTransactionDetails,
            undefined /* startAt */,
            limit,
            minPeers,
        );
    }

    public async getBalance(addresses: string[]) {
        const client = await this.client;
        const accounts = await client.getAccounts(addresses);
        return new Map(accounts.map((account, i) => [addresses[i], account.balance]));
    }

    public async getStake(addresses: string[]) {
        const client = await this.client;
        const accounts = await client.getStakers(addresses);
        return new Map(accounts.map((account, i) => [
            addresses[i],
            account
                ? account.balance + account.inactiveBalance
                : 0,
        ]));
    }

    public async getHeight() {
        const client = await this.client;
        return client.getHeadHeight();
    }

    public async getNetworkId() {
        const client = await this.client;
        return client.getNetworkId();
    }

    public async awaitConsensus() {
        await this.client;
    }

    public async isConsensusEstablished() {
        return (await this.client).isConsensusEstablished();
    }

    public async getGenesisVestingContracts() {
        return [] as Array<Nimiq.PlainVestingContract & { address: string }>; // TODO
    }

    public async relayTransaction(obj: {
        sender: string;
        senderPubKey: Uint8Array;
        recipient: string;
        value: number;
        fee: number;
        validityStartHeight: number;
        signature: Uint8Array;
        extraData?: string | Uint8Array;
    }) {
        const client = await this.client;

        const tx = Nimiq.TransactionBuilder.newBasicWithData(
            Nimiq.Address.fromString(obj.sender),
            Nimiq.Address.fromString(obj.recipient),
            typeof obj.extraData === 'string'
                ? Nimiq.BufferUtils.fromAny(obj.extraData)
                : (obj.extraData || new Uint8Array(0)),
            BigInt(obj.value),
            BigInt(obj.fee),
            obj.validityStartHeight,
            await client.getNetworkId(),
        );
        tx.proof = Nimiq.SignatureProof.singleSig(
            new Nimiq.PublicKey(obj.senderPubKey),
            Nimiq.Signature.deserialize(obj.signature),
        ).serialize();

        return client.sendTransaction(tx);
    }

    public get innerClient() {
        return this._clientPromise!;
    }

    private get client() {
        if (!this._clientPromise) throw new Error('NetworkClient not initialized');
        return this._clientPromise.then(async (client) => {
            await client.waitForConsensusEstablished();
            return client;
        });
    }

    private networkToAlbatross(network: string) {
        switch (network) {
            case NETWORK_MAIN: return 'mainalbatross';
            case NETWORK_TEST: return 'testalbatross';
            case NETWORK_DEV: return 'devalbatross';
            default: throw new Error(`${ERROR_INVALID_NETWORK}: ${network}`);
        }
    }
}
