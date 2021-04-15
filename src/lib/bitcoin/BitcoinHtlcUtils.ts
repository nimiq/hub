import { BIP84_ADDRESS_PREFIX } from './BitcoinConstants';
import { loadBitcoinJS } from './BitcoinJSLoader';
import Config from 'config';

export async function decodeBtcScript(script: string) {
    // note that buffer is marked as external module in vue.config.js and internally, the buffer bundled
    // with BitcoinJS is used, therefore we retrieve it after having BitcoinJS loaded.
    // TODO change this when we don't prebuild BitcoinJS anymore
    await loadBitcoinJS();
    const Buffer = await import('buffer').then((module) => module.Buffer);

    const error = new Error('Invalid BTC HTLC script');

    if (!script || typeof script !== 'string' || !script.length) throw error;
    const chunks = BitcoinJS.script.decompile(Buffer.from(script, 'hex'));
    if (!chunks) throw error;
    const asm = BitcoinJS.script.toASM(chunks).split(' ');

    let branchesVerifiedIndividually = false;

    /* eslint-disable no-plusplus */
    let i = 0;

    // Start redeem branch
    if (asm[i] !== 'OP_IF') throw error;

    // Check secret size
    if (asm[++i] !== 'OP_SIZE' || asm[++i] !== (32).toString(16) || asm[++i] !== 'OP_EQUALVERIFY') throw error;

    // Check hash
    if (asm[++i] !== 'OP_SHA256' || asm[i + 2] !== 'OP_EQUALVERIFY') throw error;
    const hashRoot = asm[++i];
    ++i;

    // Check redeem address
    if (asm[++i] !== 'OP_DUP' || asm[++i] !== 'OP_HASH160') throw error;
    const redeemAddressBytes = asm[++i];

    // End redeem branch, start refund branch
    if (asm[++i] !== 'OP_ELSE') {
        branchesVerifiedIndividually = true;
        if (asm[i] !== 'OP_EQUALVERIFY' || asm[++i] !== 'OP_CHECKSIG' || asm[++i] !== 'OP_ELSE') throw error;
    }

    // Check timeout
    // Bitcoin HTLC timeouts are backdated 1 hour, to account for Bitcoin's
    // minimum age for valid transaction locktimes (6 blocks).
    const timeoutTimestamp = BitcoinJS.script.number.decode(Buffer.from(asm[++i], 'hex')) + (60 * 60);
    if (asm[++i] !== 'OP_CHECKLOCKTIMEVERIFY' || asm[++i] !== 'OP_DROP') throw error;

    // Check refund address
    if (asm[++i] !== 'OP_DUP' || asm[++i] !== 'OP_HASH160') throw error;
    const refundAddressBytes = asm[++i];

    // End refund branch
    if (branchesVerifiedIndividually) {
        if (asm[++i] !== 'OP_EQUALVERIFY' || asm[++i] !== 'OP_CHECKSIG' || asm[++i] !== 'OP_ENDIF') throw error;
    } else {
        // End contract
        // eslint-disable-next-line no-lonely-if
        if (asm[++i] !== 'OP_ENDIF' || asm[++i] !== 'OP_EQUALVERIFY' || asm[++i] !== 'OP_CHECKSIG') throw error;
    }

    if (asm.length !== ++i) throw error;
    /* eslint-enable no-plusplus */

    const refundAddress = BitcoinJS.address
        .toBech32(Buffer.from(refundAddressBytes, 'hex'), 0, BIP84_ADDRESS_PREFIX[Config.bitcoinNetwork]);

    const redeemAddress = BitcoinJS.address
        .toBech32(Buffer.from(redeemAddressBytes, 'hex'), 0, BIP84_ADDRESS_PREFIX[Config.bitcoinNetwork]);

    return {
        refundAddress,
        redeemAddress,
        hashRoot,
        timeoutTimestamp,
    };
}
