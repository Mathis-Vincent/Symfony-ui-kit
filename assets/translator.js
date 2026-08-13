/**
 * Translation bridge.
 *
 * The kit controllers translate their own labels but must not depend on how the host
 * application builds its translator (`@symfony/ux-translator` + `var/translations` is
 * app-specific and cannot be resolved from the vendor directory). The host wires its
 * translator once at boot:
 *
 *     import { createTranslator } from '@symfony/ux-translator';
 *     import { localeFallbacks, messages } from '../var/translations';
 *     import { setTranslator } from '@mvincent/ui-kit/translator';
 *
 *     const translator = createTranslator({ messages, locale: 'fr', localeFallbacks });
 *     setTranslator((key, params, domain) => translator.trans(key, params, domain));
 *
 * Without any wiring the kit falls back to echoing the key, so nothing crashes.
 */

let translator = (key) => key;

/**
 * @param {(key: string, params: object, domain: string) => string} fn
 */
function setTranslator(fn) {
    if (typeof fn !== 'function') {
        throw new TypeError('setTranslator() expects a function');
    }

    translator = fn;
}

function translate(key, params = {}, domain = 'messages') {
    return translator(key, params, domain);
}

export { translate, setTranslator };
