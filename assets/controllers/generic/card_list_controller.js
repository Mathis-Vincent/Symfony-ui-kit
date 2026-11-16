import { BaseController } from "../base/base_controller";
import { translate } from "../../translator";
import * as Sentry from "@sentry/browser";

// Delay (ms) before a keystroke in the search field triggers a request.
const SEARCH_DEBOUNCE_MS = 300;

// A stat row shows its value before its label by default; "right" flips it to
const DEFAULT_VALUE_POSITION = 'left';
const VALUE_POSITION_RIGHT = 'right';

// Generic, declarative card list: server-side search + "load more" pagination.
export default class extends BaseController {
    static targets = ['searchField', 'filterField', 'grid', 'loadMore', 'loadAll', 'loader', 'frame', 'placeholder', 'empty', 'itemTemplate', 'count'];
    static values = {
        url: String,
        page: { type: Number, default: 1 },
        perPage: { type: Number, default: 12 },
        hasMore: { type: Boolean, default: false },
        autoload: { type: Boolean, default: false },
        titleField: { type: String, default: 'name' },
        clickable: { type: Boolean, default: false },
        searchParam: { type: String, default: '' },
        countKey: { type: String, default: 'count' },
        countDomain: { type: String, default: 'cardList' },
    };

    #searchTimeout;
    #currentSearch = '';
    #currentFilters = {};
    #loading = false;
    #loadingAll = false;

    connect() {
        super.connect();

        this.#applyInitialSearch();

        if (this.autoloadValue) {
            this.#currentSearch = this.hasSearchFieldTarget ? this.searchFieldTarget.value.trim() : '';
            this.pageValue = 1;
            this.#fetchPage(true);

            return;
        }

        this.#updateControls();
    }

    disconnect() {
        if (this.#searchTimeout) {
            clearTimeout(this.#searchTimeout);
            this.#searchTimeout = null;
        }
        super.disconnect();
    }

    search() {
        if (this.#searchTimeout) {
            clearTimeout(this.#searchTimeout);
        }

        this.#searchTimeout = setTimeout(() => {
            this.#currentSearch = this.hasSearchFieldTarget ? this.searchFieldTarget.value.trim() : '';
            this.#loadingAll = false;
            this.pageValue = 1;
            this.#fetchPage(true);
        }, SEARCH_DEBOUNCE_MS);
    }

    // Collect the declared filter fields and reload from the first page: like the
    // search, a new filter selection resets pagination and replaces the whole grid.
    filter() {
        this.#currentFilters = this.#collectFilters();
        this.#loadingAll = false;
        this.pageValue = 1;
        this.#fetchPage(true);
    }

    #collectFilters() {
        const filters = {};
        if (!this.hasFilterFieldTarget) {
            return filters;
        }

        for (let i = 0; i < this.filterFieldTargets.length; i++) {
            const field = this.filterFieldTargets[i];
            const param = field.dataset.filterParam;
            if (!param) {
                continue;
            }

            if (field.multiple) {
                const values = this.#selectedValues(field);
                if (values.length > 0) {
                    filters[param] = values;
                }

                continue;
            }

            const value = field.value.trim();
            if ('' !== value) {
                filters[param] = value;
            }
        }

        return filters;
    }

    // `field.value` only holds the first selected option of a `<select multiple>`;
    // Tom Select (ux-autocomplete) keeps `selectedOptions` of the original select in sync.
    #selectedValues(field) {
        const values = [];
        for (let i = 0; i < field.selectedOptions.length; i++) {
            const value = field.selectedOptions[i].value.trim();
            if ('' !== value) {
                values.push(value);
            }
        }

        return values;
    }

    loadMore() {
        if (this.#loading || !this.hasMoreValue) {
            return;
        }

        this.pageValue = this.pageValue + 1;
        this.#fetchPage(false);
    }

    // Fetch every remaining item in a single request: the server drops pagination
    // when the loadAll flag is set, so the grid is replaced with the whole perimeter.
    loadAll() {
        if (this.#loading || !this.hasMoreValue) {
            return;
        }

        this.#loadingAll = true;
        this.pageValue = 1;
        this.#fetchPage(true);
    }

    // Pre-fill the search field from the query string when the list declares which
    // parameter it listens to, so a page can deep-link into a filtered list.
    #applyInitialSearch() {
        if ('' === this.searchParamValue || !this.hasSearchFieldTarget) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const initial = params.get(this.searchParamValue);
        if (initial && initial.trim().length > 0) {
            this.searchFieldTarget.value = initial.trim();
        }
    }

    #fetchPage(reset) {
        if (this.#loading) {
            return;
        }

        this.#loading = true;

        // A search / filter / initial reload replaces the whole grid, so the
        // illustration overlays it in place. The "load more" / "load all" buttons
        // instead reveal the same illustration below the existing cards.
        if (reset && !this.#loadingAll) {
            this.#showPlaceholder(true);
        } else {
            this.#showLoader(true);
        }

        const params = new URLSearchParams({
            search: this.#currentSearch,
            page: String(this.pageValue),
            perPage: String(this.perPageValue),
        });

        if (this.#loadingAll) {
            params.set('loadAll', '1');
        }

        const filterKeys = Object.keys(this.#currentFilters);
        for (let i = 0; i < filterKeys.length; i++) {
            const key = filterKeys[i];
            const value = this.#currentFilters[key];
            if (!Array.isArray(value)) {
                params.set(key, value);

                continue;
            }

            // PHP `param[]` notation, so the value reaches Symfony as an array; no comma join
            // since a value may contain one.
            for (let j = 0; j < value.length; j++) {
                params.append(key + '[]', value[j]);
            }
        }

        fetch(this.urlValue + '?' + params.toString(), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Card list request failed with status ' + response.status);
                }

                return response.json();
            })
            .then((data) => {
                this.#render(data, reset);
            })
            .catch((error) => {
                Sentry.captureException(error);
            })
            .finally(() => {
                this.#loading = false;
                this.#loadingAll = false;
                this.#showPlaceholder(false);
                this.#showLoader(false);
            });
    }

    #render(data, reset) {
        if (!this.hasGridTarget) {
            return;
        }

        const items = Array.isArray(data.items) ? data.items : [];
        if (reset) {
            this.gridTarget.innerHTML = '';
        }

        for (let i = 0; i < items.length; i++) {
            this.gridTarget.appendChild(this.#buildCard(items[i]));
        }

        this.hasMoreValue = data.hasMore === true;
        this.#updateCount(data.totalAll);
        this.#updateControls();
    }

    #updateCount(total) {
        if (!this.hasCountTarget) {
            return;
        }

        const globalTotal = Number.isFinite(total) ? total : 0;
        const displayed = this.hasGridTarget ? this.gridTarget.children.length : 0;
        this.countTarget.textContent = translate(
            this.countKeyValue,
            { displayed: displayed, total: globalTotal },
            this.countDomainValue,
        );
    }

    #buildCard(item) {
        const clone = this.itemTemplateTarget.content.cloneNode(true);

        const titleElement = clone.querySelector('.card-list__card-title');
        if (titleElement) {
            titleElement.textContent = this.#capitalize(this.#stringify(item[this.titleFieldValue]));
        }

        const mediaElement = clone.querySelector('[data-media-field]');
        if (mediaElement) {
            this.#fillMedia(mediaElement, item);
        }

        const iconElement = clone.querySelector('[data-icon-field]');
        if (iconElement) {
            this.#fillLeadingIcon(iconElement, item);
        }

        const badgeElement = clone.querySelector('[data-badge-field]');
        if (badgeElement) {
            this.#fillBadge(badgeElement, item);
        }

        // Every `[data-field]` of the card is filled, wherever it sits: the subtitle
        // is only a particular case, so a description or a footnote binds the same way.
        this.#fillFields(clone, item);

        const subtitleElement = clone.querySelector('.card-list__card-subtitle');
        if (subtitleElement) {
            this.#revealSubtitle(subtitleElement);
        }

        const rows = clone.querySelectorAll('.card-list__card-stats [data-row-name]');
        for (let i = 0; i < rows.length; i++) {
            this.#fillStatRow(rows[i], item);
        }

        const tagsElement = clone.querySelector('[data-tags-field]');
        if (tagsElement) {
            this.#fillTags(tagsElement, item);
        }

        let card;
        if (this.clickableValue && item.url) {
            card = document.createElement('a');
            card.setAttribute('href', item.url);
        } else {
            card = document.createElement('div');
        }

        card.className = 'card-list__card';
        card.appendChild(clone);

        return card;
    }

    // Populate a leading icon from a Bootstrap icon name carried by the item.
    // The element declares which field holds the icon name (and optionally the
    // title), so the card list stays generic and the mapping lives server-side.
    #fillLeadingIcon(element, item) {
        const iconName = this.#stringify(item[element.dataset.iconField]);
        if ('' === iconName) {
            element.remove();

            return;
        }

        const iconElement = document.createElement('i');
        iconElement.className = 'bi bi-' + iconName;
        iconElement.setAttribute('aria-hidden', 'true');
        element.appendChild(iconElement);

        const titleField = element.dataset.titleField || '';
        if ('' !== titleField) {
            const title = this.#stringify(item[titleField]);
            if ('' !== title) {
                element.setAttribute('title', title);
            }
        }
    }

    // Fill an image from a source carried by the item: an URL as well as a `data:` URI,
    // so a picture stored in database renders without an extra route. The element is
    // dropped when the item has no source, leaving no empty frame behind.
    #fillMedia(element, item) {
        const source = this.#stringify(item[element.dataset.mediaField]);
        if ('' === source) {
            element.remove();

            return;
        }

        const image = document.createElement('img');
        image.className = 'card-list__card-media-image';
        image.setAttribute('src', source);
        image.setAttribute('loading', 'lazy');

        const altField = element.dataset.altField || '';
        image.setAttribute('alt', '' === altField ? '' : this.#stringify(item[altField]));

        element.appendChild(image);
    }

    // Fill a status badge, optionally styled from a second field: the item carries the
    // variant name and the badge gets the matching `--<variant>` BEM modifier.
    #fillBadge(element, item) {
        const label = this.#stringify(item[element.dataset.badgeField]);
        if ('' === label) {
            element.remove();

            return;
        }

        element.textContent = label;

        const variantField = element.dataset.badgeVariantField || '';
        if ('' === variantField) {
            return;
        }

        const variant = this.#modifier(this.#stringify(item[variantField]));
        if ('' !== variant) {
            element.classList.add('card-list__card-badge--' + variant);
        }
    }

    // Fill a list of labels from an array field (tags, technologies, ...). Anything
    // that is not a non-empty array leaves no container behind.
    #fillTags(element, item) {
        const values = item[element.dataset.tagsField];
        if (!Array.isArray(values)) {
            element.remove();

            return;
        }

        let count = 0;
        for (let i = 0; i < values.length; i++) {
            const value = this.#stringify(values[i]);
            if ('' === value) {
                continue;
            }

            const tag = document.createElement('span');
            tag.className = 'card-list__card-tag';
            tag.textContent = value;
            element.appendChild(tag);
            count++;
        }

        if (0 === count) {
            element.remove();
        }
    }

    #fillFields(root, item) {
        const fields = root.querySelectorAll('[data-field]');
        for (let i = 0; i < fields.length; i++) {
            fields[i].textContent = this.#stringify(item[fields[i].dataset.field]);
        }
    }

    // The subtitle stays hidden until one of its fields carries a value, so a card
    // without any of them keeps a clean heading instead of an empty line. The bound
    // field may be the subtitle itself as well as any element it contains.
    #revealSubtitle(element) {
        if (element.dataset.field && '' !== element.textContent) {
            element.classList.remove('d-none');

            return;
        }

        const fields = element.querySelectorAll('[data-field]');
        for (let i = 0; i < fields.length; i++) {
            if ('' !== fields[i].textContent) {
                element.classList.remove('d-none');

                return;
            }
        }
    }

    // Keep only what is valid in a CSS class suffix: the variant comes from the
    // server, and `classList.add()` throws on a value holding a space.
    #modifier(value) {
        return value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    }

    #fillStatRow(row, item) {
        const name = row.dataset.rowName;
        const icon = row.dataset.rowIcon || '';
        const color = row.dataset.rowIconColor || '';
        const position = row.dataset.rowValuePosition || DEFAULT_VALUE_POSITION;
        const label = row.textContent.trim();

        row.classList.add('card-list__stat');
        if (VALUE_POSITION_RIGHT === position) {
            row.classList.add('card-list__stat--value-right');
        }
        row.textContent = '';

        if ('' !== icon) {
            row.appendChild(this.#buildIcon(icon, color));
        }

        const valueElement = document.createElement('span');
        valueElement.className = 'card-list__stat-value';
        valueElement.textContent = this.#stringify(item[name]);

        let labelElement = null;
        if ('' !== label) {
            labelElement = document.createElement('span');
            labelElement.className = 'card-list__stat-label';
            labelElement.textContent = label;
        }

        const ordered = VALUE_POSITION_RIGHT === position
            ? [labelElement, valueElement]
            : [valueElement, labelElement];
        for (let i = 0; i < ordered.length; i++) {
            if (null !== ordered[i]) {
                row.appendChild(ordered[i]);
            }
        }
    }

    #buildIcon(icon, color) {
        const iconWrapper = document.createElement('span');
        iconWrapper.className = 'card-list__stat-icon';
        if ('' !== color) {
            iconWrapper.classList.add('card-list__stat-icon--' + color);
        }

        const iconElement = document.createElement('i');
        iconElement.className = 'bi bi-' + icon;
        iconElement.setAttribute('aria-hidden', 'true');
        iconWrapper.appendChild(iconElement);

        return iconWrapper;
    }

    #stringify(value) {
        if (value === undefined || value === null) {
            return '';
        }

        return String(value);
    }

    #capitalize(text) {
        if (0 === text.length) {
            return text;
        }

        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    #updateControls() {
        const isEmpty = this.hasGridTarget && this.gridTarget.children.length === 0;

        if (this.hasEmptyTarget) {
            this.emptyTarget.classList.toggle('d-none', !isEmpty);
        }

        if (this.hasLoadMoreTarget) {
            this.loadMoreTarget.classList.toggle('d-none', !this.hasMoreValue);
        }

        if (this.hasLoadAllTarget) {
            this.loadAllTarget.classList.toggle('d-none', !this.hasMoreValue);
        }
    }

    // Cross-fade the illustration overlay: reveal it while a full reload is in
    // flight, then fade it out and drop the initial loading frame once the grid
    // has been drawn, mirroring the DataTable placeholder behaviour.
    #showPlaceholder(show) {
        if (!this.hasPlaceholderTarget) {
            return;
        }

        if (show) {
            this.placeholderTarget.classList.remove('card-list__placeholder--hidden');

            return;
        }

        this.placeholderTarget.classList.add('card-list__placeholder--hidden');
        if (this.hasFrameTarget) {
            this.frameTarget.classList.remove('card-list__frame--loading');
        }
    }

    #showLoader(show) {
        if (this.hasLoaderTarget) {
            this.loaderTarget.classList.toggle('d-none', !show);
        }

        if (this.hasLoadMoreTarget) {
            this.loadMoreTarget.disabled = show;
        }

        if (this.hasLoadAllTarget) {
            this.loadAllTarget.disabled = show;
        }
    }
}
