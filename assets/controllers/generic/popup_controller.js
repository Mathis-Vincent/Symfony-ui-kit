import { Controller } from '@hotwired/stimulus';
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';

/**
 * Anchored popup: positions a `menu` target next to its `trigger` target with Floating UI,
 * and toggles the `is-open` class the module styles rely on.
 *
 * It is used by the DataTables page-length dropdown, which builds its markup at runtime,
 * but it is generic enough for any anchored menu:
 *
 *     <div data-controller="generic--popup" data-generic--popup-placement-value="bottom-start">
 *         <button data-generic--popup-target="trigger" data-action="generic--popup#toggle">…</button>
 *         <ul data-generic--popup-target="menu">…</ul>
 *     </div>
 */
export default class extends Controller {
    static targets = ['trigger', 'menu'];

    static values = {
        placement: { type: String, default: 'bottom-start' },
        strategy: { type: String, default: 'absolute' },
        trigger: { type: String, default: 'click' },
        offset: { type: Number, default: 4 },
    };

    #cleanup = null;

    #onDocumentClick = null;

    #onKeydown = null;

    connect() {
        this.#onDocumentClick = (event) => {
            if (this.isOpen && !this.element.contains(event.target)) {
                this.close();
            }
        };
        this.#onKeydown = (event) => {
            if (event.key === 'Escape' && this.isOpen) {
                this.close();
            }
        };

        document.addEventListener('click', this.#onDocumentClick);
        document.addEventListener('keydown', this.#onKeydown);

        if (this.triggerValue === 'hover' && this.hasTriggerTarget) {
            this.triggerTarget.addEventListener('mouseenter', () => this.open());
            this.element.addEventListener('mouseleave', () => this.close());
        }
    }

    disconnect() {
        document.removeEventListener('click', this.#onDocumentClick);
        document.removeEventListener('keydown', this.#onKeydown);
        this.#stopTracking();
    }

    get isOpen() {
        return this.hasMenuTarget && this.menuTarget.classList.contains('is-open');
    }

    toggle(event) {
        event?.preventDefault();
        event?.stopPropagation();

        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        if (!this.hasMenuTarget || !this.hasTriggerTarget || this.isOpen) {
            return;
        }

        this.menuTarget.classList.add('is-open');
        this.triggerTarget.setAttribute('aria-expanded', 'true');

        this.#cleanup = autoUpdate(this.triggerTarget, this.menuTarget, () => this.#position());
    }

    close() {
        if (!this.isOpen) {
            return;
        }

        this.menuTarget.classList.remove('is-open');
        this.triggerTarget?.setAttribute('aria-expanded', 'false');
        this.#stopTracking();
    }

    #position() {
        computePosition(this.triggerTarget, this.menuTarget, {
            placement: this.placementValue,
            strategy: this.strategyValue,
            middleware: [offset(this.offsetValue), flip(), shift({ padding: 8 })],
        }).then(({ x, y, strategy }) => {
            Object.assign(this.menuTarget.style, {
                position: strategy,
                left: `${x}px`,
                top: `${y}px`,
            });
        });
    }

    #stopTracking() {
        if (this.#cleanup !== null) {
            this.#cleanup();
            this.#cleanup = null;
        }
    }
}
