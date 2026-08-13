import { Controller } from '@hotwired/stimulus';
import * as Sentry from "@sentry/browser";

import { translate } from '../../translator'
import { Sound } from "../../js/plugin/_sound"
import Swal from "sweetalert2";
import axios from "axios";

export class BaseController extends Controller {
    /**
     * Posts an ajax form the shared way: it disables the submit button and shows its
     * loading indicator, sends the FormData, and on a server response carrying an
     * `html` payload hands it over to the caller. The submit button is always
     * re-enabled and an optional `onFinally` callback runs afterwards. Errors are
     * reported once (sound + swal) and sent to Sentry unless the server answered 403.
     *
     * @param {HTMLFormElement} form
     * @param {{onSuccess?: (data: object) => void, onFinally?: () => void}} handlers
     *
     * @returns {Promise<void>}
     */
    submitAjaxForm(form, { onSuccess, onFinally } = {}) {
        const controller = this;
        const submitButton = form.querySelector('[type=submit]');

        submitButton?.setAttribute('disabled', true);
        submitButton?.setAttribute('data-st-indicator', 'on');

        return axios
            .post(form.getAttribute('action'), new FormData(form))
            .then(function (response) {
                if (typeof response.data.html === 'undefined') {
                    return;
                }
                if (typeof onSuccess === 'function') {
                    onSuccess(response.data);
                }
            })
            .catch(function (error) {
                Sound.error.play();
                controller.showErrorHappened();
                if (error?.response?.status !== 403) {
                    Sentry.captureException(error);
                }
            })
            .finally(function () {
                submitButton?.removeAttribute('disabled');
                submitButton?.removeAttribute('data-st-indicator');
                if (typeof onFinally === 'function') {
                    onFinally();
                }
            });
    }

    #showSwalError = function (msg) {
        Swal.fire({
            title: msg,
            icon: 'error',
            buttonsStyling: false,
            confirmButtonText:
                translate('actions.ok', {}, 'messages+intl-icu'),
            customClass: {
                confirmButton: "btn btn-danger",
            },
        });
    }

    showSwalSuccess(message) {
        Swal.fire({
            title: message,
            icon: 'success',
            buttonsStyling: false,
            confirmButtonText: translate('actions.ok', {}, 'messages+intl-icu'),
            customClass: { confirmButton: "btn btn-success" },
        });
    }

    showSwalWarning(message) {
        Swal.fire({
            title: message,
            icon: 'warning',
            buttonsStyling: false,
            confirmButtonText: translate('actions.ok', {}, 'messages+intl-icu'),
            customClass: {
                confirmButton: "btn btn-warning",
            },
        });
    }

    async showSwalQuestion(title, message, confirmButtonText, cancelButtonText) {
        return await Swal.fire({
            title: title,
            text: message,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: confirmButtonText,
            cancelButtonText: cancelButtonText,
            buttonsStyling: false,
            customClass: {
                confirmButton: 'btn btn-primary',
                cancelButton: 'btn btn-light',
            },
        });
    }

    showErrorByResponse(error)
    {
        if (error?.response?.status === 403) {
            this.showAccessDenied();
        } else {
            this.showErrorHappened();
        }
    }

    showAccessDenied(msg)
    {
        if (typeof msg === 'undefined') {
            msg = translate('ajax.access_denied', {}, 'errors+intl-icu');
        }

        this.#showSwalError(msg);
    }

    showErrorHappened(msg)
    {
        if (typeof msg === 'undefined') {
            msg = translate('ajax.error', {}, 'errors+intl-icu');
        }

        this.#showSwalError(msg);
    }

    focusOnElement(elemToFocus)
    {
        if (elemToFocus instanceof Element) {
            elemToFocus.focus();
            if (typeof elemToFocus.setSelectionRange === 'function') {
                elemToFocus.setSelectionRange(elemToFocus.value.length, elemToFocus.value.length);
            } else if (typeof elemToFocus.tomselect === 'object') {
                elemToFocus.tomselect.focus();
            }
        }
    }
}
