// @ts-ignore Could not find a declaration file for module '@nimiq/iqons'.
import { getBackgroundColorName } from '@nimiq/iqons';
// @ts-ignore Could not find a declaration file for module '@nimiq/iqons/dist/iqons-name.min.js'.
import { name } from '@nimiq/iqons/dist/iqons-name.min.js';
import { i18n } from '../i18n/i18n-setup';

export function labelAddress(address: string): string {
    return name(address);
}

export function labelKeyguardAccount(firstAddress: string): string {
    const color = translateColor(getBackgroundColorName(firstAddress));
    return i18n.t('{color} Account', { color }) as string;
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

function translateColor(color: string): string {
    switch (color) {
        // Specifically list all colors for the i18n:extract script
        case 'Orange': return i18n.t('Orange') as string;
        case 'Red': return i18n.t('Red') as string;
        case 'Yellow': return i18n.t('Yellow') as string;
        case 'Indigo': return i18n.t('Indigo') as string;
        case 'Blue': return i18n.t('Blue') as string;
        case 'Purple': return i18n.t('Purple') as string;
        case 'Teal': return i18n.t('Teal') as string;
        case 'Pink': return i18n.t('Pink') as string;
        case 'Green': return i18n.t('Green') as string;
        case 'Brown': return i18n.t('Brown') as string;
        default: throw new Error(`Missing translation for color: ${color}`);
    }
}
