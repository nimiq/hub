import { MOBILE_MAX_WIDTH } from './Constants';

export function isDesktop() {
    return (window.innerWidth
        || document.documentElement.clientWidth
        || document.body.clientWidth) > MOBILE_MAX_WIDTH;
}

export function isMilliseconds(time: number) {
    /*
     * 1568577148 = timestamp at time of writing
     * 100000000000 ~ 11/16/5138
     */
    return time > 100000000000;
}
