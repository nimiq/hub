<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen
                :title="$t('Preparing Swap')"
                :status="$t('Signing transactions...')"
                state="loading"
                :lightBlue="true" />
        </SmallPage>
        <Network ref="network" :visible="false"/>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State, Getter } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { TransactionDetails as BtcTransactionDetails } from '@nimiq/electrum-client';
import { SwapAsset, PreSwap, Swap, confirmSwap, NimHtlcDetails, BtcHtlcDetails } from '../lib/FastspotApi';
import Network from '../components/Network.vue';
import { SetupSwapResult, SignedTransaction, SignedBtcTransaction } from '../lib/PublicRequestTypes';
import { Static } from '../lib/StaticStore';
import { ParsedSetupSwapRequest } from '../lib/RequestTypes';
import { WalletInfo } from '../lib/WalletInfo';
import { BTC_NETWORK_MAIN } from '../lib/bitcoin/BitcoinConstants';
import Config from 'config';

@Component({components: {Network}})
export default class SetupSwapSuccess extends Vue {
    @Static private request!: ParsedSetupSwapRequest;
    // @State private keyguardResult!: KeyguardClient.SignSwapResult;
    @Getter private findWalletByAddress!: (address: string) => WalletInfo | undefined;

    private async mounted() {
        // Confirm swap to Fastspot and get contract details

        let confirmedSwap: Swap;
        try {
            confirmedSwap = await confirmSwap({
                id: this.request.swapId,
            } as PreSwap, {
                // Redeem
                asset: this.request.redeem.type,
                address: this.request.redeem.type === SwapAsset.NIM
                    ? this.request.redeem.recipient.toUserFriendlyAddress()
                    : this.request.redeem.output.address,
            }, {
                // Refund
                asset: this.request.fund.type,
                address: this.request.fund.type === SwapAsset.NIM
                    ? this.request.fund.sender.toUserFriendlyAddress()
                    : this.request.fund.refundAddress,
            });
            // confirmedSwap.from.fee = swapSuggestion.from.fee;
            // confirmedSwap.to.fee = swapSuggestion.to.fee;

            console.debug('Swap:', confirmedSwap);
        } catch (error) {
            console.error(error);
            this.$rpc.reject(error);
            return;
        }

        // Validate contract details

        const nimHtlcData = confirmedSwap.contracts[SwapAsset.NIM]!.htlc as NimHtlcDetails;
        const btcHtlcData = confirmedSwap.contracts[SwapAsset.BTC]!.htlc as BtcHtlcDetails;

        // FIXME: Enable decoding when HTLC is part of CoreJS web-offline build
        // const htlcData = Nimiq.HashedTimeLockedContract.dataToPlain(this.keyguardRequest.redeem.htlcData);
        // if (!('hashAlgorithm' in htlcData)) {
        //     this.$rpc.reject(new Error('UNEXPECTED: Could not decode NIM htlcData'));
        //     return;
        // }
        // const { hashAlgorithm, hashCount } = htlcData;
        // const algorithm = Nimiq.Hash.Algorithm.fromString(hashAlgorithm);
        const nimHtlcByteArray = Nimiq.BufferUtils.fromHex(nimHtlcData.data);

        // TODO: Check that refund address or redeem address is correct (ours)

        const algorithm = nimHtlcByteArray[40] as Nimiq.Hash.Algorithm;
        const hashCount = nimHtlcByteArray[40 + 32 + 1];

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
        if (hashCount !== 1) {
            // Hash count must be 1 for us to accept the swap
            this.$rpc.reject(new Error('Disallowed HTLC hash count (!= 1)'));
            return;
        }

        // Construct transaction request objects

        const nimAddress = this.request.fund.type === SwapAsset.NIM
            ? this.request.fund.sender.toUserFriendlyAddress()
            : this.request.redeem.type === SwapAsset.NIM
                ? this.request.redeem.recipient.toUserFriendlyAddress()
                : ''; // Should never happen, if parsing works correctly
        const account = this.findWalletByAddress(nimAddress)!;

        const request: Partial<KeyguardClient.SignSwapTransactionsRequest> = {
            swapId: this.request.swapId,
        };

        if (this.request.fund.type === SwapAsset.NIM) {
            const senderContract = account.findContractByAddress(this.request.fund.sender);
            const signer = account.findSignerForAddress(this.request.fund.sender)!;

            request.fund = {
                type: SwapAsset.NIM,
                sender: (senderContract || signer).address.serialize(),
                senderType: senderContract ? senderContract.type : Nimiq.Account.Type.BASIC,
                value: this.request.fund.value,
                fee: this.request.fund.fee,
                validityStartHeight: this.request.fund.validityStartHeight,
                data: nimHtlcByteArray,
            };
        }

        if (this.request.fund.type === SwapAsset.BTC) {
            request.fund = {
                type: SwapAsset.BTC,
                inputs: this.request.fund.inputs,
                recipientOutput: {
                    address: btcHtlcData.address,
                    value: this.request.fund.output.value,
                },
                changeOutput: this.request.fund.changeOutput,
            };
        }

        if (this.request.redeem.type === SwapAsset.NIM) {
            request.redeem = {
                type: SwapAsset.NIM,
                sender: Nimiq.Address.fromUserFriendlyAddress(nimHtlcData.address).serialize(),
                senderType: Nimiq.Account.Type.HTLC,
                recipient: this.request.redeem.recipient.serialize(),
                value: this.request.redeem.value,
                fee: this.request.redeem.fee,
                validityStartHeight: this.request.redeem.validityStartHeight,
                data: this.request.redeem.extraData,
            };
        }

        if (this.request.redeem.type === SwapAsset.BTC) {
            // Fetch missing info from the blockchain
            // BTC tx hash and output data

            // eslint-disable-next-line no-async-promise-executor
            const { transaction, output } = await new Promise(async (resolve) => {
                function listener(tx: BtcTransactionDetails) {
                    const htlcOutput = tx.outputs.find((out) => out.address === btcHtlcData.address);
                    if (htlcOutput && htlcOutput.value === confirmedSwap.to.amount) {
                        resolve({
                            transaction: tx,
                            output: htlcOutput,
                        });
                        return true;
                    }
                    return false;
                }

                const NimiqElectrumClient = await import(/*webpackChunkName: "electrum-client"*/ '@nimiq/electrum-client');
                NimiqElectrumClient.GenesisConfig[Config.bitcoinNetwork === BTC_NETWORK_MAIN ? 'mainnet' : 'testnet']();
                const electrum = new NimiqElectrumClient.ElectrumClient();
                await electrum.waitForConsensusEstablished();

                // First check history
                const history = await electrum.getTransactionsByAddress(btcHtlcData.address);
                for (const tx of history) {
                    if (listener(tx)) return;
                }

                // Then subscribe to new transactions
                electrum.addTransactionListener(listener, [btcHtlcData.address]);
            });

            request.redeem = {
                type: SwapAsset.BTC,
                inputs: [{
                    transactionHash: transaction.transactionHash,
                    outputIndex: output.index,
                    outputScript: output.script,
                    value: this.request.redeem.input.value,
                    witnessScript: btcHtlcData.script,
                }],
                changeOutput: this.request.redeem.output,
            };
        }

        // Sign transactions via Keyguard iframe

        const client = this.$rpc.createKeyguardClient();
        const keyguardResult = await client.signSwapTransactions(request as KeyguardClient.SignSwapTransactionsRequest);

        // Construct Hub response

        let nimTx: Nimiq.Transaction;
        if (this.request.fund.type === SwapAsset.NIM) {
            nimTx = await (this.$refs.network as Network).createTx(Object.assign({
                signerPubKey: keyguardResult.nim.publicKey,
            }, keyguardResult.nim, this.request.fund, {
                recipient: Nimiq.Address.CONTRACT_CREATION,
                recipientType: Nimiq.Account.Type.HTLC,
                flags: Nimiq.Transaction.Flag.CONTRACT_CREATION,
            }));
        } else if (this.request.redeem.type === SwapAsset.NIM) {
            nimTx = await (this.$refs.network as Network).createTx(Object.assign({
                signerPubKey: keyguardResult.nim.publicKey,
            }, keyguardResult.nim, this.request.redeem, {
                sender: Nimiq.Address.fromUserFriendlyAddress(nimHtlcData.address),
                senderType: Nimiq.Account.Type.HTLC,
            }));

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
        const signature = new Nimiq.Signature(keyguardResult.nim.signature);
        if (!signature.verify(new Nimiq.PublicKey(keyguardResult.nim.publicKey), nimTx.serializeContent())) {
            this.$rpc.reject(new Error('NIM signature is invalid'));
            return;
        }

        const nimResult: SignedTransaction = await (this.$refs.network as Network).makeSignTransactionResult(nimTx);

        const btcResult: SignedBtcTransaction = {
            serializedTx: keyguardResult.btc.raw,
            hash: keyguardResult.btc.transactionHash,
        };

        const result: SetupSwapResult = {
            nim: nimResult,
            btc: btcResult,
        };

        this.$rpc.resolve(result);
    }
}
</script>
