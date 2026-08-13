import { Controller } from '@hotwired/stimulus';
import * as bootstrap from "bootstrap";

// Drives a Bootstrap offcanvas from a trigger living outside of the panel
// (e.g. the mobile bar burger). The panel is referenced through a target so the
// controller can sit on a common ancestor of both the trigger and the panel.
export default class extends Controller {
    static targets = ['panel'];

    #instance = null;

    disconnect() {
        if (this.#instance !== null) {
            this.#instance.dispose();
            this.#instance = null;
        }
    }

    toggle() {
        this.#getInstance().toggle();
    }

    #getInstance() {
        if (this.#instance === null) {
            this.#instance = bootstrap.Offcanvas.getOrCreateInstance(this.panelTarget);
        }

        return this.#instance;
    }
}
