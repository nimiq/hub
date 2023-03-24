import type { Client, PlainVestingAccount } from '@nimiq/albatross-wasm';
import Config from 'config';

export class NetworkClient {
    public static Instance: NetworkClient;

    public static hasInstance() {
        return Boolean(this.Instance);
    }

    public static createInstance() {
        this.Instance = new NetworkClient();
        return this.Instance;
    }

    private _client?: Client;

    // constructor() {}

    public async init() {
        const Nimiq = (await import('@nimiq/albatross-wasm')).default;
        const clientConfig = new Nimiq.ClientConfiguration();
        clientConfig.network(this.networkToAlbatross(Config.network));
        clientConfig.seedNodes(Config.seedNodes);
        this._client = await clientConfig.instantiateClient();
    }

    public async requestTransactionReceipts(address: string, limit?: number) {
        return this.client.getTransactionReceiptsByAddress(address, limit);
    }

    public async getBalance(addresses: string[]) {
        const accounts = await this.client.getAccounts(addresses);
        return new Map(accounts.map((account, i) => [addresses[i], account.balance]));
    }

    public async getGenesisVestingContracts() {
        return [] as Array<PlainVestingAccount & { address: string }>; // TODO
    }

    private get client() {
        if (!this._client) throw new Error('NetworkClient not initialized');
        return this._client;
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
