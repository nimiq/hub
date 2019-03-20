// @ts-ignore Could not find a declaration file for module '@nimiq/iqons'.
import { makeHash } from '@nimiq/iqons';
// @ts-ignore Could not find a declaration file for module '@nimiq/iqons/dist/iqons-name.min.js'.
import { name } from '@nimiq/iqons/dist/iqons-name.min.js';

export default class LabelingMachine {
    public static labelAddress(address: string): string {
        return name(address);
    }

    public static labelAccount(firstAddress: string): string {
        const colorNames = [
            'Orange',
            'Red',
            'Yellow',
            'Blue',
            'Light-Blue',
            'Purple',
            'Green',
            'Pink',
            'Light-Green',
            'Brown',
        ];
        const index = this.getBackgroundColorIndex(firstAddress);
        return `${colorNames[index]} Account`;
    }

    private static getBackgroundColorIndex(address: string): number {
        const hash = makeHash(address);
        return parseInt(hash[2], 10);
    }
}
