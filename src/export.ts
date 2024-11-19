import Cashlink from './lib/Cashlink';
import { CashlinkStore } from './lib/CashlinkStore';
import { CashlinkState } from '../client/PublicRequestTypes';

async function main() {
    const store = CashlinkStore.Instance;

    const cashlinkEntries = await store.list();

    const $ul = document.querySelector('#cashlinks')!;
    $ul.innerHTML = '';

    for (const entry of cashlinkEntries) {
        const cashlink = Cashlink.fromObject(entry);

        const $li = document.createElement('li');

        const $p = document.createElement('p');
        $p.textContent = `
            ${entry.value / 1e5} NIM -
            ${new Date(entry.timestamp * 1e3).toDateString()}${entry.message ? ` - ${entry.message}` : ''}
        `;
        $li.appendChild($p);

        const $a = document.createElement('a');
        const url = `${window.location.origin}/cashlink/#${cashlink.render()}`;
        $a.href = url;
        $a.textContent = url;
        $li.appendChild($a);

        $ul.appendChild($li);
    }

    if (!cashlinkEntries.length) {
        $ul.innerHTML = '<li>No cashlinks</li>';
    }
}
main();
