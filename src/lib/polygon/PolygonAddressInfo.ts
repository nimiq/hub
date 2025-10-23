// TODO move into ethers-js webpack chunk
import { utils } from 'ethers';

const { getAddress, hexlify } = utils;

export class PolygonAddressInfo {
    public static fromObject(o: PolygonAddressEntry): PolygonAddressInfo {
        return new PolygonAddressInfo(
            o.path,
            PolygonAddressInfo.objectToPolygonAddressType(o),
            o.balance,
        );
    }

    public static objectToPolygonAddressType(o: PolygonAddressEntry): string {
        return getAddress(hexlify(o.address));
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

    public equals(other: PolygonAddressInfo): boolean {
        return this.path === other.path
            && this.address.toLowerCase() === other.address.toLowerCase()
            && this.balance === other.balance;
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
