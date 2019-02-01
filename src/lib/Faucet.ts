export class Faucet {
    public static FAUCET_BACKEND = window.location.origin.indexOf('nimiq.com') !== -1
        ? 'https://faucet.nimiq-network.com/' : 'https://faucet.nimiq-testnet.com/';
    public static FAUCET_ENDPOINT_TAP = 'tapit';
    public static FAUCET_ENDPOINT_INFO = 'info';

    public static async tap(recipientAddress: string, captchaToken: string) {
        const response = await fetch(`${Faucet.FAUCET_BACKEND}${Faucet.FAUCET_ENDPOINT_TAP}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'address': recipientAddress,
                'g-recaptcha-response': captchaToken,
            })
        }).then((finalResponse) => finalResponse.json());
        if (!response.success) {
            // FIXME
            const error = new Error('Faucet error') as any;
            error.error = response.error;
            error.msg = response.msg;
            throw error;
        }
    }

    public static async info() {
        Faucet._infoPromise = Faucet._infoPromise
            || fetch(`${Faucet.FAUCET_BACKEND}${Faucet.FAUCET_ENDPOINT_INFO}`).then((response) => response.json());
        return Faucet._infoPromise;
    }

    public static async getDispenseAmount() {
        const info = await Faucet.info();
        return info.dispenseAmount; // in NIM
    }

    public static async getFaucetAddress() {
        const info = await Faucet.info();
        return info.address;
    }

    private static _infoPromise: Promise<any>;
}
