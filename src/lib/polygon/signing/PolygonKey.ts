import { Key } from './Key';
import { ethers } from 'ethers';
import Config from 'config';

export class PolygonKey {
    private _key: Key;

    constructor(key: Key) {
        if (key.type !== Nimiq.Secret.Type.ENTROPY) {
            throw new Error('Key must be of type Nimiq.Entropy');
        }
        this._key = key;
    }

    deriveAddress(path: string): string {
        const wallet = this.deriveKeyPair(path);
        return wallet.address;
    }

    async sign(path: string, transaction: ethers.providers.TransactionRequest): Promise<string> {
        const wallet = this.deriveKeyPair(path);
        return wallet.signTransaction(transaction);
    }

    async signTypedData(
        path: string,
        domain: ethers.TypedDataDomain,
        types: Record<string, Array<ethers.TypedDataField>>,
        value: Record<string, any>,
    ): Promise<string> {
        const wallet = this.deriveKeyPair(path);
        return wallet._signTypedData(domain, types, value);
    }

    async signUsdtApproval(
        path: string,
        usdtContract: ethers.Contract,
        forwarderContractAddress: string,
        approvalAmount: ethers.BigNumber,
        tokenNonce: number,
        fromAddress: string,
    ): Promise<{sigR: string, sigS: string, sigV: number}> {
        const functionSignature = usdtContract.interface.encodeFunctionData(
            'approve',
            [forwarderContractAddress, approvalAmount],
        );

        // TODO: Make the domain parameters configurable in the request?
        const domain = {
            name: 'USDT0', // This is currently the same for testnet(?) and mainnet
            version: '1', // This is currently the same for testnet and mainnet
            verifyingContract: Config.polygon.usdt_bridged.tokenContract,
            salt: ethers.utils.hexZeroPad(ethers.utils.hexlify(Config.polygon.networkId), 32),
        };

        const types = {
            MetaTransaction: [
                { name: 'nonce', type: 'uint256' },
                { name: 'from', type: 'address' },
                { name: 'functionSignature', type: 'bytes' },
            ],
        };

        const message = {
            nonce: tokenNonce,
            from: fromAddress,
            functionSignature,
        };

        const signature = await this.signTypedData(
            path,
            domain,
            types,
            message,
        );

        return this._signatureToParts(signature);
    }

    deriveKeyPair(path: string): ethers.Wallet {
        const mnemonic = Nimiq.MnemonicUtils.entropyToMnemonic(this.secret as Nimiq.Entropy);
        return ethers.Wallet.fromMnemonic(mnemonic.join(' '), path);
    }

    key(): Key {
        return this._key;
    }

    private _signatureToParts(signature: string): {sigR: string, sigS: string, sigV: number} {
        const sigR = signature.slice(0, 66); // 0x prefix plus 32 bytes = 66 characters
        const sigS = `0x${signature.slice(66, 130)}`; // 32 bytes = 64 characters
        const sigV = parseInt(signature.slice(130, 132), 16); // last byte = 2 characters

        return { sigR, sigS, sigV };
    }

    get id(): string {
        return this._key.id;
    }

    get secret(): Nimiq.Entropy {
        return this._key.secret as Nimiq.Entropy;
    }

    get type(): Nimiq.Secret.Type {
        return this._key.type;
    }
}
