import { Key } from './signing/Key';
import { PolygonKey } from './signing/PolygonKey';
import { ethers } from 'ethers';
import Config from 'config';
import { TypedRequestData } from '@opengsn/common/dist/EIP712/TypedRequestData';
import { createTransactionRequest, getPolygonClient, sendTransaction, Transaction } from './ethers';
import { USDT_BRIDGED_TRANSFER_CONTRACT_ABI, USDT_BRIDGED_TOKEN_CONTRACT_ABI } from './ContractABIs';

export async function createRedeemCashlinkTransaction(
    entropy: Nimiq.Entropy,
    amount: number,
    recipient: string,
): Promise<Transaction> {
    const key = new Key(entropy);
    const polygonKey = new PolygonKey(key);

    const fromAddress = polygonKey.deriveAddress('m');

    const txrequest = await createTransactionRequest(
        Config.polygon.usdt_bridged.tokenContract,
        fromAddress,
        recipient,
        amount,
    )

    const client = await getPolygonClient();
    const cashlinkContract = new ethers.Contract(
        Config.polygon.usdt_bridged.cashlinkContract,
        USDT_BRIDGED_TRANSFER_CONTRACT_ABI,
        client.provider,
    );

    // Decode the request description
    const description = cashlinkContract.interface.parseTransaction({
        data: txrequest.relayRequest.request.data,
        value: txrequest.relayRequest.request.value,
    });

    // Sign approval for the necessary amount
    const { sigR, sigS, sigV } = await polygonKey.signUsdtApproval(
        'm',
        new ethers.Contract(
            Config.polygon.usdt_bridged.tokenContract,
            USDT_BRIDGED_TOKEN_CONTRACT_ABI,
        ),
        Config.polygon.usdt_bridged.cashlinkContract,
        description.args.approval,
        txrequest.approval.tokenNonce,
        fromAddress,
    );

    // Add approval signature into tx data
    txrequest.relayRequest.request.data = cashlinkContract.interface.encodeFunctionData(description.name, [
        /* address token */ description.args.token,
        /* uint256 amount */ description.args.amount,
        /* address pool */ description.args.pool,
        /* uint256 targetAmount */ description.args.targetAmount,
        /* uint256 fee */ description.args.fee,
        /* uint256 approval */ description.args.approval,
        /* bytes32 sigR */ sigR,
        /* bytes32 sigS */ sigS,
        /* uint8 sigV */ sigV,
    ]);

    const typedData = new TypedRequestData(
        Config.polygon.networkId,
        Config.polygon.usdt_bridged.cashlinkContract,
        txrequest.relayRequest,
    );

    const { EIP712Domain, ...cleanedTypes } = typedData.types;

    // Sign the relay request
    const signature = await polygonKey.signTypedData(
        'm',
        typedData.domain,
        cleanedTypes as unknown as Record<string, ethers.TypedDataField[]>,
        typedData.message,
    );

    return sendTransaction(
        Config.polygon.usdt_bridged.tokenContract,
        txrequest.relayRequest,
        signature,
        txrequest.relay.url,
    );
}