<template>
    <Network ref="network" :visible="false"/>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import Network from '../components/Network.vue';
import { SetupSwapResult, SignedTransaction, SignedBtcTransaction } from '../lib/PublicRequestTypes';
import { State } from 'vuex-class';
import { Static } from '../lib/StaticStore';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {Network}})
export default class SetupSwapSuccess extends Vue {
    @Static private keyguardRequest!: KeyguardClient.SignSwapRequest;
    @State private keyguardResult!: KeyguardClient.SignSwapResult;

    private async mounted() {
        let nimTx: Nimiq.Transaction;
        if (this.keyguardRequest.fund.type === 'NIM') {
            nimTx = await (this.$refs.network as Network).createTx(Object.assign({
                signerPubKey: this.keyguardResult.nim.publicKey,
            }, this.keyguardResult.nim, this.keyguardRequest.fund, {
                recipient: Nimiq.Address.CONTRACT_CREATION,
                recipientType: Nimiq.Account.Type.HTLC,
                flags: Nimiq.Transaction.Flag.CONTRACT_CREATION,
            }));
        } else if (this.keyguardRequest.redeem.type === 'NIM') {
            nimTx = await (this.$refs.network as Network).createTx(Object.assign({
                signerPubKey: this.keyguardResult.nim.publicKey,
            }, this.keyguardResult.nim, this.keyguardRequest.redeem));

            // FIXME: Enable decoding when HTLC is part of CoreJS web-offline build
            // const htlcData = Nimiq.HashedTimeLockedContract.dataToPlain(this.keyguardRequest.redeem.htlcData);
            // if (!('hashAlgorithm' in htlcData)) {
            //     this.$rpc.reject(new Error('UNEXPECTED: Could not decode NIM htlcData'));
            //     return;
            // }
            // const { hashAlgorithm, hashCount } = htlcData;
            // const algorithm = Nimiq.Hash.Algorithm.fromString(hashAlgorithm);
            const algorithm = this.keyguardRequest.redeem.htlcData[40] as Nimiq.Hash.Algorithm;
            const hashCount = this.keyguardRequest.redeem.htlcData[40 + 32 + 1];

            if (algorithm === Nimiq.Hash.Algorithm.ARGON2D) {
                // Blacklisted for HTLC creation
                this.$rpc.reject(new Error('Disallowed HTLC hash algorithm (Argon2d)'));
                return;
            }
            const hashSize = Nimiq.Hash.SIZE.get(algorithm)!;
            if (hashSize !== 32) {
                // Hash must be 32 bytes, as otherwise it cannot work with the BTC HTLC
                this.$rpc.reject(new Error('Disallowed HTLC hash length (!= 32 bytes)'));
                return;
            }

            const preImage = '0000000000000000000000000000000000000000000000000000000000000000';
            const hashRoot = '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925'; // SHA256 of preImage

            const proof = new Nimiq.SerialBuffer(3 + 2 * 32 + Nimiq.SignatureProof.SINGLE_SIG_SIZE);
            // FIXME: Use constant when HTLC is part of CoreJS web-offline build
            proof.writeUint8(1 /* Nimiq.HashedTimeLockedContract.ProofType.REGULAR_TRANSFER */);
            proof.writeUint8(algorithm);
            proof.writeUint8(hashCount);
            proof.write(Nimiq.BufferUtils.fromHex(hashRoot));
            proof.write(Nimiq.BufferUtils.fromHex(preImage));
            proof.write(new Nimiq.SerialBuffer(nimTx.proof)); // Current tx.proof is a regular SignatureProof
            nimTx.proof = proof;
        } else {
            this.$rpc.reject(new Error('Could not find NIM transaction data in Keyguard request'));
            return;
        }

        // FIXME: Enable validation when HTLC is part of CoreJS web-offline build
        // // Validate that transaction is valid
        // if (!nimTx.verify()) {
        //     this.$rpc.reject(new Error('NIM transaction is invalid'));
        //     return;
        // }

        // Validate signature
        const signature = new Nimiq.Signature(this.keyguardResult.nim.signature);
        if (!signature.verify(new Nimiq.PublicKey(this.keyguardResult.nim.publicKey), nimTx.serializeContent())) {
            this.$rpc.reject(new Error('NIM signature is invalid'));
            return;
        }

        const nimResult: SignedTransaction = await (this.$refs.network as Network).makeSignTransactionResult(nimTx);

        const btcResult: SignedBtcTransaction = {
            serializedTx: this.keyguardResult.btc.raw,
            hash: this.keyguardResult.btc.transactionHash,
        };

        const result: SetupSwapResult = {
            nim: nimResult,
            btc: btcResult,
        };

        this.$rpc.resolve(result);
    }
}
</script>
