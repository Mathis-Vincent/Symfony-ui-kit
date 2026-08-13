/**
 * Public front entrypoint of the UI kit.
 *
 * Register the controllers on the host Stimulus application with the same names the
 * Twig layouts use (`stimulus_prefix` in the bundle configuration, `generic--` by default):
 *
 *     import { Application } from '@hotwired/stimulus';
 *     import { registerUiKitControllers } from '@mvincent/ui-kit';
 *
 *     const app = Application.start();
 *     registerUiKitControllers(app);
 */

import CardListController from './controllers/generic/card_list_controller';
import ChartController from './controllers/generic/chart_controller';
import DatatablesController from './controllers/generic/datatables_controller';
import OffcanvasController from './controllers/generic/offcanvas_controller';
import PopupController from './controllers/generic/popup_controller';

import { BaseController } from './controllers/base/base_controller';
import { Sound } from './js/plugin/_sound';
import { setTranslator, translate } from './translator';

/**
 * @param {import('@hotwired/stimulus').Application} application
 * @param {string} prefix must match the bundle's `mvincent_ui_kit.stimulus_prefix`
 */
function registerUiKitControllers(application, prefix = 'generic--') {
    application.register(`${prefix}card-list`, CardListController);
    application.register(`${prefix}chart`, ChartController);
    application.register(`${prefix}datatables`, DatatablesController);
    application.register(`${prefix}offcanvas`, OffcanvasController);
    application.register(`${prefix}popup`, PopupController);
}

export {
    registerUiKitControllers,
    CardListController,
    ChartController,
    DatatablesController,
    OffcanvasController,
    PopupController,
    BaseController,
    Sound,
    setTranslator,
    translate,
};
