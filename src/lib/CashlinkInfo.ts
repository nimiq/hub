export enum CashlinkType {
    OUTGOING = 0,
    INCOMING = 1,
}

export enum CashlinkState {
    UNKNOWN = -1,
    UNCHARGED = 0,
    CHARGING = 1,
    UNCLAIMED = 2,
    CLAIMING = 3,
    CLAIMED = 4,
}

export class CashlinkInfo {
    public static fromObject(object: CashlinkInfoEntry): CashlinkInfo {
        return new CashlinkInfo(
            object.address,
            new Nimiq.PrivateKey(object.privateKey),
            object.type,
            object.value,
            object.message,
            object.date,
            object.state,
            object.name,
            object.otherParty,
            object.contactName,
        );
    }

    public constructor(
        public address: string,
        public privateKey: Nimiq.PrivateKey,
        public type: CashlinkType,
        public value: number,
        public message: string,
        public date: number,
        public state: CashlinkState,
        public name?: string,
        public otherParty?: string, /** originalSender | finalRecipient */
        public contactName?: string, /** unused for now */
    ) { }

    public toObject(): CashlinkInfoEntry {
        return {
            address: this.address,
            privateKey: this.privateKey.serialize().subarray(0, Nimiq.PrivateKey.SIZE),
            type: this.type,
            value: this.value,
            message: this.message,
            date: this.date,
            state: this.state,
            name: this.name,
            otherParty: this.otherParty,
            contactName: this.contactName,
        };
    }
}

export interface CashlinkInfoEntry {
    address: string;
    privateKey: Uint8Array;
    type: CashlinkType;
    value: number;
    message: string;
    date: number;
    state: CashlinkState;
    name?: string;
    otherParty?: string; /** originalSender | finalRecipient */
    contactName?: string; /** unused for now */
}
