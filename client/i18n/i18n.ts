// Import the languages you want to support. Note that the language files are not lazy loaded on purpose, as they are
// pretty small.
import de from './de.json';
import en from './en.json';
import es from './es.json';
import fil from './fil.json';
import fr from './fr.json';
import nl from './nl.json';
import ru from './ru.json';
import zh from './zh.json';

const translations: { [lang: string]: { [id: string]: string } } = { de, en, es, fil, fr, nl, ru, zh };

export default function translate(id: string, language?: string) {
    if (!language) {
        // Note that third party apps won't have access to the language cookie and will use a fallback language.
        const langMatch = document.cookie.match(/(^| )lang=([^;]+)/);
        language = (langMatch && langMatch[2]) || navigator.language.split('-')[0];
    }
    return (translations[language] || en)[id] || (en as { [id: string]: string })[id];
}
