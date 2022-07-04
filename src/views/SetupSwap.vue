<script lang="ts">
import { Component } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import { SmallPage } from '@nimiq/vue-components';
import Config from 'config';
import BitcoinSyncBaseView from './BitcoinSyncBaseView.vue';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import { KycProvider } from '../lib/PublicRequestTypes';
import { ParsedSetupSwapRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { BtcAddressInfo } from '../lib/bitcoin/BtcAddressInfo';
import { SwapAsset } from '@nimiq/fastspot-api';
import { GrantResponse, ServiceRequest } from '@nimiq/ten31-pass-api';
import { DEFAULT_KEY_PATH } from '../lib/Constants';

// Import only types to avoid bundling of KeyguardClient in Ledger request if not required.
// (But note that currently, the KeyguardClient is still always bundled in the RpcApi).
type KeyguardSignSwapRequest = import('@nimiq/keyguard-client').SignSwapRequest;
export type SwapSetupInfo = Pick<KeyguardSignSwapRequest, 'fund' | 'redeem'>;

@Component({components: {StatusScreen, SmallPage, GlobalClose}}) // including components used in parent class
export default class SetupSwap extends BitcoinSyncBaseView {
    @Static protected request!: ParsedSetupSwapRequest;
    @Static protected ten31PassGrantResponse?: GrantResponse;
    @Getter protected findWallet!: (id: string) => WalletInfo | undefined;
    protected _account!: WalletInfo;
    protected _isDestroyed: boolean = false;

    protected async mounted() {
        // use mounted instead of created to ensure that SetupSwapLedger has the chance to run its created hook before.

        // Request or validate grant response for KYC enabled swaps.
        const s3ServiceId = Config.TEN31Pass.services.s3.serviceId;
        const oasisServiceId = Config.TEN31Pass.services.oasis.serviceId;
        if (this.request.kyc && this.request.kyc.provider === KycProvider.TEN31PASS && !this.ten31PassGrantResponse) {
            // Request grants.
            const serviceRequests: ServiceRequest[] = [{
                serviceId: s3ServiceId,
                usages: [{
                    usageId: Config.TEN31Pass.services.s3.usageIds.swap,
                    parameters: {
                        from_amount: this.request.fund.type === SwapAsset.NIM ? this.request.fund.value
                            : this.request.fund.type === SwapAsset.BTC ? this.request.fund.output.value
                                : this.request.fund.value,
                        from_asset: this.request.fund.type,
                        to_amount: this.request.redeem.type === SwapAsset.NIM ? this.request.redeem.value
                            : this.request.redeem.type === SwapAsset.BTC ? this.request.redeem.output.value
                                : this.request.redeem.value,
                        to_asset: this.request.redeem.type,
                        id: this.request.swapId,
                    },
                }],
            }];
            if (this.request.fund.type === 'EUR') {
                serviceRequests.push({
                    serviceId: oasisServiceId,
                    usages: [{
                        usageId: Config.TEN31Pass.services.oasis.usageIds.clearing,
                        parameters: {
                            amount: this.request.fund.value,
                        },
                    }],
                });
            } else if (this.request.redeem.type === 'EUR') {
                serviceRequests.push({
                    serviceId: oasisServiceId,
                    usages: [{
                        usageId: Config.TEN31Pass.services.oasis.usageIds.settling,
                        parameters: {
                            amount: this.request.redeem.value,
                        },
                    }],
                });
            }
            // Redirect to TEN31 PASS.
            await this.$rpc.ten31PassClient.requestGrants(this.request.kyc.appId, serviceRequests, /* asPopup */ false);
            return;
        } else if (this.ten31PassGrantResponse) {
            // Validate grant response
            try {
                const appGrant = await this.$rpc.ten31PassClient.getAppGrantInfo(this.ten31PassGrantResponse.app);
                const s3Grant = this.ten31PassGrantResponse.services[s3ServiceId];
                const oasisGrant = this.ten31PassGrantResponse.services[oasisServiceId];
                if (!appGrant || !s3Grant
                    || ((this.request.fund.type === 'EUR' || this.request.redeem.type === 'EUR') && !oasisGrant)) {
                    throw new Error('TEN31 PASS didn\'t return expected grants.');
                }
                if (appGrant.user.id !== this.request.kyc!.userId) {
                    throw new Error(`Unexpected TEN31 PASS user ${appGrant.user.displayName}.`);
                }
            } catch (e) {
                this.$rpc.reject(e);
                return;
            }
        }

        // existence checked by _hubApiHandler in RpcApi
        this._account = this.findWallet(this.request.walletId)!;

        try {
            const swapSetupInfo = await this._collectSwapSetupInfo();
            if (this._isDestroyed || !swapSetupInfo) return; // destroyed or failed and is displaying an error
            this._setupSwap(swapSetupInfo);
        } catch (e) {
            this.error = e.message || e;
            if (this.state === this.State.SYNCING_FAILED // keep the error message displayed and offer to retry
                || this._isDestroyed) return;
            this.$rpc.reject(e);
        }
    }

    protected destroyed() {
        this._isDestroyed = true;
    }

    protected _setupSwap(swapSetupInfo: SwapSetupInfo) {
        // note that this method gets overwritten for SetupSwapLedger

        const keyguardRequest: KeyguardSignSwapRequest = {
            ...swapSetupInfo,

            appName: this.request.appName,

            keyId: this._account.keyId,
            keyLabel: this._account.labelForKeyguard,

            swapId: this.request.swapId,

            // Display data
            fiatCurrency: this.request.fiatCurrency,
            fundingFiatRate: this.request.fundingFiatRate,
            redeemingFiatRate: this.request.redeemingFiatRate,
            fundFees: this.request.fundFees,
            redeemFees: this.request.redeemFees,
            serviceSwapFee: this.request.serviceSwapFee,
            ...(this.request.layout === 'slider' ? {
                layout: 'slider',
                nimiqAddresses: this.request.nimiqAddresses!, // existence ensured by RequestParser
                bitcoinAccount: this.request.bitcoinAccount!,
            } : {
                layout: 'standard',
            }),
        };

        const client = this.$rpc.createKeyguardClient(true);
        client.signSwap(keyguardRequest);
    }

    protected async _collectSwapSetupInfo(): Promise<SwapSetupInfo | null> {
        // Note that the sync state will only be visible in the UI if the sync is not instant (if we actually sync)
        this.state = this.State.SYNCING;

        if ((this.request.fund.type === SwapAsset.BTC || this.request.redeem.type === SwapAsset.BTC)
            && (!this._account.btcXPub || !this._account.btcAddresses || !this._account.btcAddresses.external.length)) {
            throw new Error(`Account does not have any Bitcoin addresses`);
        }

        let fundingInfo: SwapSetupInfo['fund'] | null = null;
        let redeemingInfo: SwapSetupInfo['redeem'] | null = null;

        if (this.request.fund.type === SwapAsset.NIM) {
            const senderContract = this._account.findContractByAddress(this.request.fund.sender);
            const signer = this._account.findSignerForAddress(this.request.fund.sender);

            if (!signer) {
                throw new Error(`Unknown sender ${this.request.fund.sender.toUserFriendlyAddress()}`);
            }

            fundingInfo = {
                type: SwapAsset.NIM,
                keyPath: signer.path,
                sender: (senderContract || signer).address.serialize(),
                senderType: senderContract ? senderContract.type : Nimiq.Account.Type.BASIC,
                senderLabel: (senderContract || signer).label,
                value: this.request.fund.value,
                fee: this.request.fund.fee,
                validityStartHeight: this.request.fund.validityStartHeight,
            };
        }

        if (this.request.fund.type === SwapAsset.BTC) {
            if (!this.request.fund.inputs.length) {
                throw new Error('No BTC funding inputs provided');
            }

            const addresses = this.request.fund.inputs
                .map((input) => input.address)
                .concat(
                    this.request.fund.changeOutput ? this.request.fund.changeOutput.address : [],
                    this.request.fund.refundAddress,
                );
            // Only derive BTC addresses once for the account, not multiple times if addresses are fake
            let didDeriveAddresses = false;
            const addressInfos: { [address: string]: BtcAddressInfo | null } = {};
            try {
                for (const address of addresses) {
                    let addressInfo = this._account.findBtcAddressInfo(address, !didDeriveAddresses);
                    if (addressInfo instanceof Promise) {
                        didDeriveAddresses = true;
                        addressInfo = await addressInfo;
                    }
                    addressInfos[address] = addressInfo;
                }
            } catch (e) {
                this.state = this.State.SYNCING_FAILED;
                throw e;
            }

            // Validate that we own the refund address
            const refundAddressInfo = addressInfos[this.request.fund.refundAddress];
            if (!refundAddressInfo) {
                throw new Error(`Refund address not found: ${this.request.fund.refundAddress}`);
            }

            // Validate that we own the change address
            if (this.request.fund.changeOutput) {
                const addressInfo = addressInfos[this.request.fund.changeOutput.address];
                if (!addressInfo) {
                    throw new Error(`Change address not found: ${this.request.fund.changeOutput.address}`);
                }
            }

            fundingInfo = {
                type: SwapAsset.BTC,
                inputs: this.request.fund.inputs.map((input) => {
                    const addressInfo = addressInfos[input.address];
                    if (!addressInfo) {
                        throw new Error(`Input address not found: ${input.address}`);
                    }
                    return {
                        ...input,
                        keyPath: addressInfo.path,
                    };
                }),
                recipientOutput: this.request.fund.output,
                ...(this.request.fund.changeOutput ? {
                    changeOutput: {
                        ...this.request.fund.changeOutput,
                        keyPath: addressInfos[this.request.fund.changeOutput.address]!.path,
                    },
                } : {}),
                locktime: this.request.fund.locktime,
                refundKeyPath: refundAddressInfo.path,
            };
        }

        if (this.request.fund.type === SwapAsset.EUR) {
            fundingInfo = {
                type: SwapAsset.EUR,
                amount: this.request.fund.value,
                fee: this.request.fund.fee,
                bankLabel: this.request.fund.bankLabel,
            };
        }

        if (this.request.redeem.type === SwapAsset.NIM) {
            const signer = this._account.findSignerForAddress(this.request.redeem.recipient);
            if (!signer) {
                throw new Error(`Redeem address not found: ${this.request.redeem.recipient}`);
            }

            if (!signer.address.equals(this.request.redeem.recipient)) {
                throw new Error(`Redeem address cannot be a contract`);
            }

            redeemingInfo = {
                type: SwapAsset.NIM,
                keyPath: signer.path,
                recipient: signer.address.serialize(),
                recipientLabel: signer.label,
                value: this.request.redeem.value,
                fee: this.request.redeem.fee,
                validityStartHeight: this.request.redeem.validityStartHeight,
            };
        }

        if (this.request.redeem.type === SwapAsset.BTC) {
            let addressInfo: BtcAddressInfo | null;
            try {
                addressInfo = await this._account.findBtcAddressInfo(this.request.redeem.output.address);
            } catch (e) {
                this.state = this.State.SYNCING_FAILED;
                throw e;
            }
            if (!addressInfo) {
                throw new Error(`Redeem address not found: ${this.request.redeem.output.address}`);
            }

            redeemingInfo = {
                type: SwapAsset.BTC,
                input: {
                    ...this.request.redeem.input,
                    keyPath: addressInfo.path,
                },
                output: {
                    ...this.request.redeem.output,
                    keyPath: addressInfo.path,
                },
            };
        }

        if (this.request.redeem.type === SwapAsset.EUR) {
            redeemingInfo = {
                type: SwapAsset.EUR,
                keyPath: DEFAULT_KEY_PATH,
                settlement: this.request.redeem.settlement,
                amount: this.request.redeem.value,
                fee: this.request.redeem.fee,
                bankLabel: this.request.redeem.bankLabel,
            };
        }

        if (!fundingInfo || !redeemingInfo) {
            throw new Error('Funding or redeeming info missing.');
        }

        this.state = this.State.NONE;
        return { fund: fundingInfo, redeem: redeemingInfo };
    }
}
</script>
