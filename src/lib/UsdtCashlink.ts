import { CashlinkState, CashlinkTheme } from '../../client/PublicRequestTypes';

// TODO [USDT-CASHLINK]: This is a MOCK implementation for UI development
// Replace with actual Polygon/OpenGSN integration when backend is ready

export const UsdtCashlinkExtraData = {
    FUNDING: '0x46554e44', // 'FUND' in hex
    CLAIMING: '0x434c41494d', // 'CLAIM' in hex
};

export interface UsdtCashlinkEntry {
    address: string; // Polygon address (0x...)
    privateKey: string; // Mock private key
    value: number; // USDT amount in cents (6 decimals), e.g., 50000000 = 50.00 USDT
    fee?: number; // Fee in USDT cents
    message: string;
    state: CashlinkState;
    timestamp: number;
    theme?: CashlinkTheme;
    contactName?: string;
}

class UsdtCashlink {
    get value() {
        return this._value || 0;
    }

    set value(value: number) {
        if (this._value && (this._immutable || this.state !== CashlinkState.UNCHARGED)) {
            throw new Error('Cannot set value, USDT Cashlink is immutable');
        }
        if (!Number.isInteger(value) || value <= 0) throw new Error('Malformed USDT Cashlink value');
        this._value = value;
    }

    set fee(fee: number) {
        if (this.state === CashlinkState.CLAIMED) {
            console.warn('Setting a fee will typically have no effect anymore as USDT Cashlink is already claimed');
        }
        this._fee = fee;
    }

    get fee() {
        return this._fee || 0;
    }

    get message() {
        return this._message;
    }

    set message(message: string) {
        if (this._message && (this._immutable || this.state !== CashlinkState.UNCHARGED)) {
            throw new Error('Cannot set message, USDT Cashlink is immutable');
        }
        if (message.length > 255) throw new Error('USDT Cashlink message is too long');
        this._message = message;
    }

    get theme() {
        return this._theme || UsdtCashlink.DEFAULT_THEME;
    }

    set theme(theme: CashlinkTheme) {
        if (this._theme && (this._immutable || this.state !== CashlinkState.UNCHARGED)) {
            throw new Error('Cannot set theme, USDT Cashlink is immutable');
        }
        this._theme = !Object.values(CashlinkTheme).includes(theme)
            ? CashlinkTheme.UNSPECIFIED
            : theme;
    }

    get hasEncodedTheme() {
        return !!this._theme;
    }

    public static create(): UsdtCashlink {
        // TODO [USDT-CASHLINK]: Replace with actual Polygon keypair generation
        // Should use ethers.Wallet.createRandom() or similar
        const mockPrivateKey = '0x' + Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)).join('');
        const mockAddress = '0x' + Array.from({ length: 40 }, () =>
            Math.floor(Math.random() * 16).toString(16)).join('');

        return new UsdtCashlink(mockPrivateKey, mockAddress);
    }

    public static parse(str: string): UsdtCashlink | null {
        if (!str) return null;
        try {
            // TODO [USDT-CASHLINK]: Implement actual USDT cashlink parsing
            // Expected format: U<base64url-encoded-data>
            // Should contain: privateKey (32 bytes), value (8 bytes), message (variable), theme (1 byte)

            if (!str.startsWith('U')) {
                console.error('Invalid USDT Cashlink format: must start with "U"');
                return null;
            }

            // Mock implementation: decode base64url
            const encoded = str.substring(1);
            const decoded = atob(encoded.replace(/-/g, '+').replace(/_/g, '/').replace(/~/g, ''));

            // Mock parsing - in reality would properly deserialize the data
            const mockPrivateKey = '0x' + Array.from({ length: 64 }, () =>
                Math.floor(Math.random() * 16).toString(16)).join('');
            const mockAddress = '0x' + Array.from({ length: 40 }, () =>
                Math.floor(Math.random() * 16).toString(16)).join('');

            // Extract some mock data from the decoded string for demonstration
            const value = 50000000; // Mock: 50.00 USDT
            const message = decoded.length > 100 ? decoded.substring(100, 200) : 'Mock USDT Cashlink';

            return new UsdtCashlink(
                mockPrivateKey,
                mockAddress,
                value,
                undefined,
                message,
                CashlinkState.UNKNOWN,
            );
        } catch (e) {
            console.error('Error parsing USDT Cashlink:', e);
            return null;
        }
    }

    public static fromObject(object: UsdtCashlinkEntry): UsdtCashlink {
        return new UsdtCashlink(
            object.privateKey,
            object.address,
            object.value,
            object.fee,
            object.message,
            object.state,
            object.theme,
            object.timestamp,
            object.contactName,
        );
    }

    /**
     * USDT Cashlink balance in cents (6 decimals)
     */
    public balance: number | null = null;
    public state: CashlinkState;

    private _immutable: boolean;
    private _eventListeners: {[type: string]: Array<(data: any) => void>} = {};
    private _message: string = '';
    private _value: number | null = null;
    private _fee: number | null = null;
    private _theme: CashlinkTheme = CashlinkTheme.UNSPECIFIED;

    constructor(
        public privateKey: string,
        public address: string,
        value?: number,
        fee?: number,
        message?: string,
        state: CashlinkState = CashlinkState.UNCHARGED,
        theme?: CashlinkTheme,
        public timestamp: number = Math.floor(Date.now() / 1000),
        public contactName?: string,
    ) {
        if (value) this.value = value;
        if (fee) this.fee = fee;
        if (message) this.message = message;
        if (theme) this.theme = theme;
        this.state = state;

        this._immutable = !!(value || message || theme);

        // TODO [USDT-CASHLINK]: Replace with actual Polygon network integration
        // Should connect to Polygon network via ethers.js provider
        // Should listen for transactions on this address
        // Should check balance via USDT token contract

        // Mock state detection with delays
        this.detectState();
    }

    public async detectState() {
        // TODO [USDT-CASHLINK]: Replace with actual state detection
        // Should query Polygon network for:
        // - USDT token balance at this address
        // - Transaction history (funding and claiming transactions)
        // - Contract events for this cashlink

        // Mock implementation with setTimeout delays
        const balance = await this._awaitBalance();

        if (this.state === CashlinkState.CLAIMED && !balance) return;

        // Simulate state transitions
        setTimeout(() => {
            let newState: CashlinkState = this.state;

            switch (this.state) {
                case CashlinkState.UNKNOWN:
                    newState = CashlinkState.UNCHARGED;
                    break;
                case CashlinkState.CHARGING:
                    // Mock: after 3 seconds, transition to UNCLAIMED
                    newState = CashlinkState.UNCLAIMED;
                    this.balance = this._value;
                    this.fire(UsdtCashlink.Events.BALANCE_CHANGE, this.balance);
                    break;
                case CashlinkState.CLAIMING:
                    // Mock: after 3 seconds, transition to CLAIMED
                    newState = CashlinkState.CLAIMED;
                    this.balance = 0;
                    this.fire(UsdtCashlink.Events.BALANCE_CHANGE, this.balance);
                    break;
            }

            if (newState !== this.state) this._updateState(newState);
        }, 3000);
    }

    public toObject(includeOptional: boolean = true): UsdtCashlinkEntry {
        const result: UsdtCashlinkEntry = {
            privateKey: this.privateKey,
            address: this.address,
            value: this.value,
            message: this.message,
            state: this.state,
            theme: this._theme,
            timestamp: this.timestamp,
        };
        if (includeOptional) {
            result.fee = this.fee;
            result.contactName = this.contactName;
        }
        return result;
    }

    public render() {
        // TODO [USDT-CASHLINK]: Implement proper encoding
        // Should encode: privateKey + value + message + theme
        // Format: U<base64url-encoded-data>

        // Mock implementation
        const data = JSON.stringify({
            pk: this.privateKey,
            v: this.value,
            m: this.message,
            t: this._theme,
        });

        let result = 'U' + btoa(data)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '.');

        // Break long words for WhatsApp compatibility
        result = result.replace(/[A-Za-z0-9_-]{257,}/g, (match) => match.replace(/.{256}/g, '$&~'));

        return result;
    }

    public getFundingDetails(): {
        address: string,
        value: number,
        fee: number,
        data: string,
        cashlinkMessage: string,
    } {
        // TODO [USDT-CASHLINK]: Replace with actual OpenGSN ForwardRequest structure
        // Should return proper relay request for keyguard to sign
        return {
            address: this.address,
            value: this.value,
            fee: this.fee,
            data: UsdtCashlinkExtraData.FUNDING,
            cashlinkMessage: this.message,
        };
    }

    public async claim(
        recipientAddress: string,
        fee: number = this.fee,
    ): Promise<void> {
        // TODO [USDT-CASHLINK]: Replace with actual claim transaction
        // Should:
        // 1. Create OpenGSN relay request to transfer USDT to recipient
        // 2. Sign with this cashlink's private key
        // 3. Send to relay/network

        if (this.state >= CashlinkState.CLAIMING) {
            throw new Error('Cannot claim, USDT Cashlink has already been claimed');
        }

        const balance = Math.min(this.value, await this._awaitBalance());
        if (!balance) {
            throw new Error('Cannot claim, there is no balance in this link');
        }

        console.log('[MOCK] Claiming USDT Cashlink:', {
            from: this.address,
            to: recipientAddress,
            amount: balance - fee,
            fee,
        });

        this._updateState(CashlinkState.CLAIMING);

        // Mock: simulate transaction relay
        setTimeout(() => {
            this._updateState(CashlinkState.CLAIMED);
            this.balance = 0;
            this.fire(UsdtCashlink.Events.BALANCE_CHANGE, this.balance);
        }, 3000);
    }

    public on(type: UsdtCashlink.Events, callback: (data: any) => void): void {
        if (!(type in this._eventListeners)) {
            this._eventListeners[type] = [];
        }
        this._eventListeners[type].push(callback);
    }

    public off(type: UsdtCashlink.Events, callback: (data: any) => void): void {
        if (!(type in this._eventListeners)) {
            return;
        }
        const index = this._eventListeners[type].indexOf(callback);
        if (index === -1) {
            return;
        }
        this._eventListeners[type].splice(index, 1);
    }

    public fire(type: UsdtCashlink.Events, arg: any): void {
        if (!(type in this._eventListeners)) {
            return;
        }
        this._eventListeners[type].forEach((callback) => callback(arg));
    }

    private async _awaitBalance(): Promise<number> {
        if (this.balance !== null) return this.balance;

        // Mock: return value if in funded state
        if (this.state === CashlinkState.UNCLAIMED || this.state === CashlinkState.CLAIMING) {
            this.balance = this._value || 0;
            return this.balance;
        }

        return new Promise(async (resolve) => {
            const handler = async (balance: number) => {
                this.off(UsdtCashlink.Events.BALANCE_CHANGE, handler);
                resolve(balance);
            };
            this.on(UsdtCashlink.Events.BALANCE_CHANGE, handler);
        });
    }

    private _updateState(state: CashlinkState) {
        this.state = state;
        this.fire(UsdtCashlink.Events.STATE_CHANGE, this.state);
    }
}

namespace UsdtCashlink {
    export enum Events {
        BALANCE_CHANGE = 'balance-change',
        STATE_CHANGE = 'state-change',
    }

    export const DEFAULT_THEME = CashlinkTheme.STANDARD;
}

export default UsdtCashlink;
