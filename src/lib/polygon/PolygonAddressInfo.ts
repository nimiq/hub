import { bytesToHex } from '@nimiq/electrum-client/electrum-ws/helpers';
import { utils } from 'ethers';

const { getAddress } = utils;

export class PolygonAddressInfo {
    public static fromObject(o: PolygonAddressEntry): PolygonAddressInfo {
        return new PolygonAddressInfo(
            o.path,
            PolygonAddressInfo.objectToPolygonAddressType(o),
            o.balance,
        );
    }

    public static objectToPolygonAddressType(o: PolygonAddressEntry): string {
        return getAddress(`0x${bytesToHex(o.address)}`);
    }

    public constructor(
        public path: string,
        public address: string,
        public balance?: number,
    ) {}

    public toObject(): PolygonAddressEntry {
        return {
            path: this.path,
            address: Nimiq.BufferUtils.fromHex(this.address.toLowerCase().substring(2)),
            balance: this.balance,
        };
    }

    public toPolygonAddressType(): string {
        return this.address;
    }
}

/*
 * Database Types
 */
export interface PolygonAddressEntry {
    path: string;
    address: Uint8Array;
    balance?: number;
}
