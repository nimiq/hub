export default function patchMerkleTree() {
    // Patch the Nimiq core MerkleTree class until it gets actually shipped with the Nimiq core web-offline package.
    if (typeof Nimiq.MerkleTree !== 'undefined') {
        console.warn('Nimiq.MerkleTree patch not required anymore and can be removed.');
    } else {
        type Hashable = Nimiq.Hash | Uint8Array | { hash: () => Nimiq.Hash } | { serialize: () => Uint8Array };

        class MerkleTree {
            public static computeRoot(
                values: Hashable[],
                fnHash = MerkleTree._hash,
            ): Nimiq.Hash {
                return MerkleTree._computeRoot(values, fnHash);
            }

            private static _computeRoot(values: Hashable[], fnHash: typeof MerkleTree._hash): Nimiq.Hash {
                const len = values.length;
                if (len === 0) {
                    return Nimiq.Hash.light(new Uint8Array(0));
                }
                if (len === 1) {
                    return fnHash(values[0]);
                }

                const mid = Math.round(len / 2);
                const left = values.slice(0, mid);
                const right = values.slice(mid);
                const leftHash = MerkleTree._computeRoot(left, fnHash);
                const rightHash = MerkleTree._computeRoot(right, fnHash);
                return Nimiq.Hash.light(
                    Nimiq.BufferUtils.concatTypedArrays(leftHash.serialize(), rightHash.serialize()) as Uint8Array,
                );
            }

            private static _hash(o: Hashable): Nimiq.Hash {
                if (o instanceof Nimiq.Hash) {
                    return o;
                }
                if ('hash' in o && typeof o.hash === 'function') {
                    return o.hash();
                }
                if ('serialize' in o && typeof o.serialize === 'function') {
                    return Nimiq.Hash.light(o.serialize());
                }
                if (o instanceof Uint8Array) {
                    return Nimiq.Hash.light(o);
                }
                throw new Error('MerkleTree objects must be Uint8Array or have a .hash()/.serialize() method');
            }
        }

        Nimiq.MerkleTree = MerkleTree;
    }
}
