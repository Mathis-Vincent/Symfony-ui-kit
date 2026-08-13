/**
 * Feedback sounds shipped with the bundle. The files live in the bundle's `public/sounds`
 * directory, published by `bin/console assets:install` under `/bundles/mvincentuikit`.
 *
 * If the host application publishes them elsewhere, call `Sound.configure('/my/path/')`
 * once at boot (before the first playback).
 */
class Sound {
    static #path = '/bundles/mvincentuikit/sounds/internal/';

    static #cache = {};

    /** @param {string} path */
    static configure(path) {
        Sound.#path = path.endsWith('/') ? path : path + '/';
        Sound.#cache = {};
    }

    /** @returns {HTMLAudioElement} */
    static get error() {
        return Sound.#get('error.mp3');
    }

    /** @returns {HTMLAudioElement} */
    static get success() {
        return Sound.#get('ok.mp3');
    }

    static #get(file) {
        if (typeof Sound.#cache[file] === 'undefined') {
            Sound.#cache[file] = new Audio(Sound.#path + file);
        }

        return Sound.#cache[file];
    }
}

export { Sound };
