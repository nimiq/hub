// @ts-ignore Could not find a declaration file for module '@nimiq/iqons'.
import { getBackgroundColorName } from '@nimiq/iqons';
import { i18n } from '../i18n/i18n-setup';

export function labelAddress(address: string): string {
    const color = getBackgroundColorName(address) as string;
    switch (color) {
        // Specifically list all colors for the i18n:extract script
        case 'Orange': return i18n.t('Orange Address') as string;
        case 'Red': return i18n.t('Red Address') as string;
        case 'Yellow': return i18n.t('Yellow Address') as string;
        case 'Indigo': return i18n.t('Indigo Address') as string;
        case 'Blue': return i18n.t('Blue Address') as string;
        case 'Purple': return i18n.t('Purple Address') as string;
        case 'Teal': return i18n.t('Teal Address') as string;
        case 'Pink': return i18n.t('Pink Address') as string;
        case 'Green': return i18n.t('Green Address') as string;
        case 'Brown': return i18n.t('Brown Address') as string;
        default: throw new Error(`Missing address translation for color: ${color}`);
    }
}

export function labelKeyguardAccount(firstAddress: string): string {
    const color = getBackgroundColorName(firstAddress);
    switch (color) {
        // Specifically list all colors for the i18n:extract script
        case 'Orange': return i18n.t('Orange Account') as string;
        case 'Red': return i18n.t('Red Account') as string;
        case 'Yellow': return i18n.t('Yellow Account') as string;
        case 'Indigo': return i18n.t('Indigo Account') as string;
        case 'Blue': return i18n.t('Blue Account') as string;
        case 'Purple': return i18n.t('Purple Account') as string;
        case 'Teal': return i18n.t('Teal Account') as string;
        case 'Pink': return i18n.t('Pink Account') as string;
        case 'Green': return i18n.t('Green Account') as string;
        case 'Brown': return i18n.t('Brown Account') as string;
        default: throw new Error(`Missing account translation for color: ${color}`);
    }
}

export function labelLedgerAccount(): string {
    return i18n.t('Ledger Account') as string;
}

export function labelLegacyAccount(): string {
    return i18n.t('Legacy Account') as string;
}

export function labelVestingContract(): string {
    return i18n.t('Vesting Contract') as string;
}

export function labelHashedTimeLockedContract(): string {
    return 'HTLC';
}

export function labelLegacyAccountGroup(): string {
    return i18n.t('Single Accounts') as string;
}
