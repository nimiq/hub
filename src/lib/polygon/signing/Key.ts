export class Key {
    private _secret: Nimiq.Entropy | Nimiq.PrivateKey;
    private _id?: string;

    static deriveHash(input: Uint8Array): string {
        return Nimiq.BufferUtils.toBase64(Nimiq.Hash.computeBlake2b(input));
    }

    constructor(secret: Nimiq.Entropy | Nimiq.PrivateKey) {
        this._secret = secret;
    }

    derivePublicKey(path: string): Nimiq.PublicKey {
        return Nimiq.PublicKey.derive(this.derivePrivateKey(path));
    }

    deriveAddress(path: string): Nimiq.Address {
        return this.derivePublicKey(path).toAddress();
    }

    sign(path: string, data: Uint8Array): Nimiq.Signature {
        const privateKey = this.derivePrivateKey(path);
        const publicKey = Nimiq.PublicKey.derive(privateKey);
        return Nimiq.Signature.create(privateKey, publicKey, data);
    }

    derivePrivateKey(path: string): Nimiq.PrivateKey {
        return this._secret instanceof Nimiq.Entropy
            ? this._secret.toExtendedPrivateKey().derivePath(path).privateKey
            : this._secret;
    }

    get id(): string {
        if (!this._id) {
            this._id = this.hash;
        }
        return this._id;
    }

    get secret(): Nimiq.Entropy | Nimiq.PrivateKey {
        return this._secret;
    }

    get type(): Nimiq.Secret.Type {
        return this._secret instanceof Nimiq.PrivateKey
            ? Nimiq.Secret.Type.PRIVATE_KEY
            : Nimiq.Secret.Type.ENTROPY;
    }

    get hash(): string {
        // Private keys use the address as input, as during migration of legacy accounts
        // their entropy or public key is not known, as it is stored encrypted.
        const input = this._secret instanceof Nimiq.Entropy
            ? this._secret.serialize()
            : Nimiq.PublicKey.derive(this._secret).toAddress().serialize();
        return Key.deriveHash(input);
    }

    equals(other: unknown): other is Key {
        return other instanceof Key
            && this.id === other.id
            && this.type === other.type
            && this.secret.equals(other.secret as Nimiq.PrivateKey);
    }
}
