import Vue from 'vue';
import VueI18n from 'vue-i18n';
import { Cookie } from '@nimiq/utils';
import router from '../router';

Vue.use(VueI18n);

const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = [DEFAULT_LANGUAGE, 'fr'];
const LOADED_LANGUAGES: string[] = []; // our default language that is preloaded, if any

export const i18n = new VueI18n({
    locale: DEFAULT_LANGUAGE, // set locale (2 letters format: 'en')
    fallbackLocale: DEFAULT_LANGUAGE, // fallback locale if no translation found
    silentTranslationWarn: true, // disable the "no translation found" warning
});

function setI18nLanguage(lang: string) {
    i18n.locale = lang;
    return lang;
}

// Asynchronously load a translation file for a specified language
// and set this one as the active language
export async function loadLanguage(lang: string) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) lang = DEFAULT_LANGUAGE;

    // If the language was already loaded
    if (LOADED_LANGUAGES.includes(lang)) {
        return setI18nLanguage(lang);
    }

    // If the language hasn't been loaded yet
    const messages = await import(/* webpackChunkName: "lang-[request]" */ `@/i18n/${lang}.po`);
    i18n.setLocaleMessage(lang, messages.default || {});
    LOADED_LANGUAGES.push(lang);
    return setI18nLanguage(lang);
}

// Return the language stored in the `lang` cookie. Fallback to the browser language
export function detectLanguage() {
    const langCookie = Cookie.getCookie('lang');
    const langRaw = window.navigator.language;
    const langParts = langRaw.split('-');

    return langCookie || langParts[0];
}

// If the user changed the language in another window/tab,
// then ask him if he wants to reload the page to update non-reactive translations
let alreadyAskedTheUser = false;
function onTabFocus() {
    if (alreadyAskedTheUser) return;

    const lang = detectLanguage();
    if (i18n.locale !== lang) {
        alreadyAskedTheUser = true;
        const question = i18n.t('The display language changed. Do you want to reload the page to update all '
            + 'translations? Otherwise, some translations might not be updated automatically. ({oldLang} to {newLang})',
            { oldLang: i18n.locale, newLang: lang }) as string;

        if (confirm(question)) {
            location.reload();
        } else {
            loadLanguage(detectLanguage());
        }
    }
}

// Set a window/tab focus event to check if the user changed the language in another window/tab
window.addEventListener('focus', onTabFocus);

// This router navigation guard is to prevent switching
// to the new route before the language file finished loading.
router.beforeResolve((to, from, next) =>
    loadLanguage(detectLanguage()).then(() => next()),
);
