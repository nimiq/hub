// @ts-ignore Could not find a declaration file for module '@nimiq/iqons'.
import { getBackgroundColorName } from '@nimiq/iqons';
// @ts-ignore Could not find a declaration file for module '@nimiq/iqons/dist/iqons-name.min.js'.
import { name } from '@nimiq/iqons/dist/iqons-name.min.js';

export default class LabelingMachine {
    public static labelAddress(address: string): string {
        return name(address);
    }

    public static labelAccount(firstAddress: string): string {
        return `${getBackgroundColorName(firstAddress)} Account`;
    }
}
