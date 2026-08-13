import { Application } from '@hotwired/stimulus';
import { registerUiKitControllers } from '@mvincent/ui-kit';

import './styles/app.scss';

// No translator wiring here on purpose: the kit falls back to echoing its keys, which is
// enough for visual work. Call `setTranslator(...)` if you want to check the wording.
const application = Application.start();
registerUiKitControllers(application);

window.Stimulus = application;
