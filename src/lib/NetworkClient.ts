import type {
    Client as AlbatrossClient,
    ClientConfiguration as AlbatrossClientConfiguration,
    PlainVestingContract,
} from '@nimiq/albatross-wasm';
import Config from 'config';

declare global {
    interface Window {
        loadAlbatross: () => Promise<{
            Client: typeof AlbatrossClient,
            ClientConfiguration: typeof AlbatrossClientConfiguration,
        }>;
    }
}

export class NetworkClient {
    private static _instance?: NetworkClient;

    public static get Instance() {
        if (!this._instance) this._instance = new NetworkClient();
        return this._instance;
    }

    private _clientPromise?: Promise<AlbatrossClient>;

    // constructor() {}

    public async init() {
        const initPromise = this._clientPromise || (this._clientPromise = new Promise(async (resolve) => {
            const { Client, ClientConfiguration } = await window.loadAlbatross();
            const clientConfig = new ClientConfiguration();
            clientConfig.network(this.networkToAlbatross(Config.network));
            clientConfig.seedNodes(Config.seedNodes);
            clientConfig.logLevel('debug');
            resolve(Client.create(clientConfig.build()));
        }));

        await initPromise;
    }

    public async requestTransactionReceipts(address: string, limit?: number) {
        const client = await this.client;
        return client.getTransactionReceiptsByAddress(address, limit);
    }

    public async getBalance(addresses: string[]) {
        const client = await this.client;
        const accounts = await client.getAccounts(addresses);
        return new Map(accounts.map((account, i) => [addresses[i], account.balance]));
    }

    public async getGenesisVestingContracts() {
        return [] as Array<PlainVestingContract & { address: string }>; // TODO
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
            case 'main': return 'albatross';
            case 'test': return 'testalbatross';
            case 'dev': return 'devalbatross';
            default: throw new Error(`Unknown network: ${network}`);
        }
    }
}
