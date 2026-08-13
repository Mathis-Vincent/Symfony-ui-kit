import {BaseController} from "../base/base_controller";
import * as Sentry from "@sentry/browser";
import DataTable from 'datatables.net-bs5';
import 'datatables.net-select-bs5';
import { translate } from '../../translator'

// Viewport width (px) below which the tables switch to the "accordion" card layout.
const MOBILE_BREAKPOINT = 768;

// Page-length choices offered in the length menu, and the fallback used when the
// table declares no (or an invalid) data-page-length.
const DEFAULT_PAGE_LENGTHS = [10, 25, 50, 100];
const DEFAULT_PAGE_LENGTH = 10;

export default class extends BaseController {
    static targets = [ 'table', 'loader', 'filterField', 'multiSelectRow', 'multiActionContainer' , 'multiActionSelectCount'];

    validator;
    datatable;
    stickyObserver;
    stickySentinel;
    #rowToggleHandler;
    #refreshHandler;

    connect() {
        super.connect();

        if (this.tableTarget.dataset.urlPopulate) {
            const columns = this.#buildColumns();

            let bInfo = true;
            if (this.tableTarget?.dataset?.disableTotalInfo) {
                bInfo = false;
            }

            let pageLength = parseInt(this.tableTarget?.dataset?.pageLength, 10);
            if (isNaN(pageLength) || pageLength <= 0) {
                pageLength = DEFAULT_PAGE_LENGTH;
            }

            let lengthMenu = [];
            let pageLengthPlaced = false;
            for (let i = 0; i < DEFAULT_PAGE_LENGTHS.length; i++) {
                const value = DEFAULT_PAGE_LENGTHS[i];
                if (!pageLengthPlaced && pageLength <= value) {
                    lengthMenu.push(pageLength);
                    pageLengthPlaced = true;
                }
                if (value !== pageLength) {
                    lengthMenu.push(value);
                }
            }
            if (!pageLengthPlaced) {
                lengthMenu.push(pageLength);
            }

            // The "first / last" pagination arrows are opt-in: without the flag
            // DataTables renders only the previous / next arrows and page numbers.
            const pagingType = this.tableTarget?.dataset?.activeFirstLast
                ? 'full_numbers'
                : 'simple_numbers';

            let options = {
                ajax: this.tableTarget.dataset.urlPopulate,
                processing: true,
                serverSide: true,
                // Let the browser distribute the table width across the columns
                // that actually exist. With DataTables' own "autoWidth" it pins
                // computed pixel widths and leaves a large gap when a column is
                // removed instead of re-spreading the freed space.
                autoWidth: false,
                pageLength: pageLength,
                lengthMenu: lengthMenu,
                pagingType: pagingType,
                select: {
                    style: 'multi',
                    selector: 'td:first-child input[type="checkbox"]',
                    className: 'row-selected'
                },
                language: {
                    search: translate('search', {}, 'dataTable'),
                    emptyTable: translate('emptyTable', {}, 'dataTable'),
                    zeroRecords: translate('zeroRecords', {}, 'dataTable'),
                    info: translate('info', {}, 'dataTable'),
                    infoEmpty: translate('infoEmpty', {}, 'dataTable'),
                    lengthMenu: translate('lengthMenu', {}, 'dataTable'),
                    infoFiltered: '',
                    paginate : {
                        first: translate('paginate.first', {}, 'dataTable'),
                        last: translate('paginate.last', {}, 'dataTable'),
                        next: translate('paginate.next', {}, 'dataTable'),
                        previous: translate('paginate.previous', {}, 'dataTable'),
                    }
                },
                bInfo: bInfo,
                bFilter: true,
                columns: columns,
                rowCallback: function(row, data, displayNum, displayIndex) {
                    // Mobile "accordion": the first row of the page is expanded by default.
                    if (displayIndex === 0) {
                        row.classList.add('js-dt-open');
                    }

                    let thNames = [];
                    if (0 in this) {
                        let th = this[0].querySelectorAll('thead th');
                        th.forEach(function(elem) {
                            thNames.push(elem.innerText);
                        });
                    }

                    // Usefull to add a js class on every td of the datatable
                    let count = 1;
                    for (const [key, value] of Object.entries(data)) {
                        let td = row.querySelector('td:nth-child('+count+')');
                        if (td) {
                            td.classList.add('js-dt-'+key);
                            td.dataset.columnName = key;
                            if (thNames.length > 0 && (count -1) in thNames) {
                                let label = thNames[count -1].trim();
                                if (label.length > 0) {
                                    td.dataset.columnLabel = thNames[count -1].trim();
                                }
                            }
                        }
                        count++;
                    }
                    // The "expired" row highlight (js-dt-expired) is applied server-side
                    // through DataTables' DT_RowClass: it is a business rule (tag /
                    // marketing operation) that does not belong in this generic controller.
                }
            };

            const defaultOrder = this.#buildDefaultOrder();
            if (defaultOrder) {
                options.order = defaultOrder;
            }

            // Opt-in initial search from the URL: the table declares the query
            // parameter name it listens to (data-url-search-param), so several tables
            // on the same route can each target their own parameter. DataTables fills
            // its native search box from options.search on init.
            const searchParamName = this.tableTarget?.dataset?.urlSearchParam;
            if (searchParamName) {
                const params = new URLSearchParams(window.location.search);
                const urlSearch = params.get(searchParamName)?.trim();
                if (urlSearch) {
                    options.search = {
                        search: urlSearch
                    };
                }
            }

            // Opt-in initial column filtering: a filter <select> may be rendered with
            // a server-selected option (e.g. reached from a stats card carrying a query
            // param). We seed the matching column search so the first ajax load is
            // already filtered. Fields are scoped to this controller instance, so tables
            // sharing a route never read each other's filters.
            const initialSearchCols = this.#buildInitialSearchCols(columns);
            if (initialSearchCols) {
                options.searchCols = initialSearchCols;
            }

            // Compose the top-start row: optional table title moved out of the card header
            const topStartItems = [];
            const tableTitle = this.element.querySelector('.card-title');
            if (tableTitle) {
                topStartItems.push(tableTitle);
            }

            // Compose the top-end row: native search bar (if enabled), the filter
            // dropdown, then the free-form action buttons. They all live in the same
            // row so they reflow together on mobile, like the search bar and filters.
            const topEndItems = [];
            if (this.tableTarget.dataset.activeSearch) {
                topEndItems.push('search');
            }

            const filterToolbar = this.element.querySelector('.card-filters');
            if (filterToolbar) {
                topEndItems.push(filterToolbar);
            }

            const actionsToolbar = this.element.querySelector('.card-actions');
            if (actionsToolbar) {
                topEndItems.push(actionsToolbar);
            }

            // The page length control is opt-in: without it DataTables would not
            // render the ".dt-length" container the custom dropdown relies on.
            const activeLengthMenu = !!this.tableTarget?.dataset?.activeLengthMenu;

            options.layout = {
                topStart: topStartItems.length > 0 ? topStartItems : null,
                topEnd: topEndItems.length > 0 ? topEndItems : null,
                bottomStart: activeLengthMenu ? ['pageLength', 'info'] : 'info',
                bottomEnd: 'paging'
            };

            if (columns.length > 0) {
                this.datatable = new DataTable(
                    this.tableTarget,
                    options
                );
                // The illustration overlay replaces every DataTables loading
                // animation: it is revealed while the server processes a request
                // (initial load, search, sort, filter, pagination) and cross-faded
                // out once the rows are drawn.
                this.datatable.on('processing.dt', (event, settings, processing) => {
                    if (processing) {
                        this.#showLoader();

                        return;
                    }

                    this.#hideLoader();
                });
                if (activeLengthMenu) {
                    this.#buildLengthDropdown(lengthMenu, pageLength);
                }
                if (this.tableTarget?.dataset?.stickyHeader) {
                    this.#setupStickyHeader();
                }
            } else {
                Sentry.captureException(
                    new Error("No column found at " + window.location.href)
                );
            }

            // The filter toolbar was moved into the table layout: drop the card header if nothing else remains
            const cardHeader = this.element.querySelector('.card-header');
            if (cardHeader && cardHeader.children.length === 0) {
                cardHeader.remove();
            }

            if (this.tableTarget) {
                this.#refreshHandler = this.#refreshTable.bind(this);
                this.tableTarget.addEventListener('dt.refresh', this.#refreshHandler);

                this.#rowToggleHandler = this.#onRowToggle.bind(this);
                this.tableTarget.addEventListener('click', this.#rowToggleHandler);
            }
        }
    }

    disconnect() {
        if (this.stickyObserver) {
            this.stickyObserver.disconnect();
            this.stickyObserver = null;
        }
        if (this.stickySentinel) {
            this.stickySentinel.remove();
            this.stickySentinel = null;
        }
        if (this.hasTableTarget) {
            if (this.#rowToggleHandler) {
                this.tableTarget.removeEventListener('click', this.#rowToggleHandler);
                this.#rowToggleHandler = null;
            }
            if (this.#refreshHandler) {
                this.tableTarget.removeEventListener('dt.refresh', this.#refreshHandler);
                this.#refreshHandler = null;
            }
        }
        if (this.datatable) {
            this.datatable.destroy();
            this.datatable = null;
        }
        super.disconnect();
    }

    // Build the DataTables column definitions from the <th> cells. Besides the
    // data key, it forwards two mobile-only flags as CSS classes applied to every
    // cell of the column so the responsive "accordion" layout can react:
    //   - data-mobile-hide  -> "js-dt-mobile-hide"  (column dropped on mobile)
    //   - data-mobile-title -> "js-dt-mobile-title" (summary cell, always shown)
    // When no <th> carries data-mobile-title, the first visible, labelled column
    // is promoted to the summary cell automatically.
    #buildColumns() {
        const columns = [];
        const headers = this.tableTarget.querySelectorAll('th');
        const hasExplicitTitle = this.tableTarget.querySelector('th[data-mobile-title]') !== null;
        let autoTitleAssigned = false;

        for (const th of headers) {
            const columnName = th.dataset?.columnName;
            const columnSelect = th.dataset?.selectName;
            if (columnName === undefined && columnSelect === undefined) {
                continue;
            }

            // use class "d-none" on a th (column) to hide a column and data but still be used in a filter
            const classes = [];
            const isHidden = th.classList.contains('d-none');
            if (isHidden) {
                classes.push('d-none');
            }
            if (th.dataset?.mobileHide !== undefined) {
                classes.push('js-dt-mobile-hide');
            }

            let isTitle = false;
            if (hasExplicitTitle) {
                isTitle = th.dataset?.mobileTitle !== undefined;
            } else if (!autoTitleAssigned && !isHidden
                && th.dataset?.mobileHide === undefined
                && th.textContent.trim().length > 0) {
                isTitle = true;
                autoTitleAssigned = true;
            }
            if (isTitle) {
                classes.push('js-dt-mobile-title');
            }

            // A column is orderable by default; set data-orderable="false" on its
            // <th> to lock it (e.g. an "actions" or "roles" column).
            const orderable = th.dataset?.orderable !== 'false';

            // data-column-class lets a <th> forward extra class(es) to every cell
            // of its column (e.g. a narrow "select" column or a compact "actions"
            // column), so the generic layout can style special columns.
            if (th.dataset?.columnClass !== undefined) {
                classes.push(th.dataset.columnClass);
            }

            const className = classes.join(' ');
            if (columnName !== undefined) {
                columns.push({ data: columnName, className: className, orderable: orderable });
            } else {
                columns.push({ data: null, render: DataTable.render.select(), className: className, orderable: orderable });
            }
        }

        return columns;
    }

    // Resolve the initial sort as a DataTables order array. A table-level
    // data-default-order (set via dt_default_orderable) takes precedence and is
    // resolved by column name, supporting several columns; otherwise we fall back to
    // the <th> carrying data-default-orderable. Returns null when no default sort is
    // declared.
    #buildDefaultOrder() {
        const rawOrder = this.tableTarget?.dataset?.defaultOrder;
        if (rawOrder) {
            return this.#buildOrderFromNames(rawOrder);
        }

        const headers = this.tableTarget.querySelectorAll('th');
        let columnIndex = -1;

        for (const th of headers) {
            const columnName = th.dataset?.columnName;
            const columnSelect = th.dataset?.selectName;
            if (columnName === undefined && columnSelect === undefined) {
                continue;
            }

            columnIndex++;
            if (th.dataset?.defaultOrderable !== undefined) {
                const direction = th.dataset.defaultOrderable === 'desc' ? 'desc' : 'asc';
                return [[columnIndex, direction]];
            }
        }

        return null;
    }

    // Parse the table-level data-default-order (a JSON array of [columnName, direction]
    // pairs) and translate each pair into a [columnIndex, direction] entry. Pairs whose
    // column name is unknown are skipped. The direction defaults to "asc". Returns null
    // when the JSON is invalid or no pair resolves to a column.
    #buildOrderFromNames(rawOrder) {
        let pairs;
        try {
            pairs = JSON.parse(rawOrder);
        } catch (error) {
            Sentry.captureException(error);
            return null;
        }

        if (!Array.isArray(pairs)) {
            return null;
        }

        const order = [];
        for (const pair of pairs) {
            if (!Array.isArray(pair) || pair.length < 1) {
                continue;
            }

            const index = this.#columnIndexOf(pair[0]);
            if (index === null) {
                continue;
            }

            const direction = pair[1] === 'desc' ? 'desc' : 'asc';
            order.push([index, direction]);
        }

        return order.length > 0 ? order : null;
    }

    // Resolve the DataTables column index of a column name, walking the same <th>
    // subset as #buildColumns so the index matches the column definitions. Returns
    // null when no visible/selectable column carries that name.
    #columnIndexOf(columnName) {
        const headers = this.tableTarget.querySelectorAll('th');
        let columnIndex = -1;

        for (const th of headers) {
            const name = th.dataset?.columnName;
            const columnSelect = th.dataset?.selectName;
            if (name === undefined && columnSelect === undefined) {
                continue;
            }

            columnIndex++;
            if (name === columnName) {
                return columnIndex;
            }
        }

        return null;
    }

    // Build the initial DataTables per-column search state from the filter fields
    // whose <select> already carries a non-default value on load. Returns an array
    // aligned with the column definitions ({search: value} at the filtered column,
    // null elsewhere), or null when no filter field is pre-selected.
    #buildInitialSearchCols(columns) {
        if (!this.hasFilterFieldTarget) {
            return null;
        }

        const searchCols = new Array(columns.length).fill(null);
        let hasInitial = false;
        for (const field of this.filterFieldTargets) {
            const columnName = field.dataset?.filterColumnName;
            const value = field.value;
            if (!columnName || !value || value === '0') {
                continue;
            }

            const index = this.#columnIndexOf(columnName);
            if (index === null) {
                continue;
            }

            searchCols[index] = { search: value };
            hasInitial = true;
        }

        return hasInitial ? searchCols : null;
    }

    // Mobile "accordion": tapping a card's summary cell (the always-visible title
    // row) toggles the card open/closed. Interactive controls inside the cell keep
    // their own behaviour, and the handler is a no-op above the mobile breakpoint.
    #onRowToggle(event) {
        if (window.innerWidth > MOBILE_BREAKPOINT) {
            return;
        }

        const title = event.target.closest('td.js-dt-mobile-title');
        if (!title || event.target.closest('a, button, input, label, select')) {
            return;
        }

        const row = title.closest('tr');
        if (row) {
            row.classList.toggle('js-dt-open');
        }
    }

    // Watch a zero-height sentinel sitting just above the table: once it scrolls
    // past the sticky app header, the headers are pinned and we flag the table so
    // the "navigation" shadow appears, inviting the user to scroll back up.
    #setupStickyHeader() {
        const scroll = this.element.querySelector('.data-table__scroll');
        if (!scroll) {
            return;
        }

        const header = document.querySelector('.app-layout__header');
        const offset = header ? header.offsetHeight : 0;

        const sentinel = document.createElement('div');
        sentinel.className = 'data-table__sticky-sentinel';
        scroll.prepend(sentinel);
        this.stickySentinel = sentinel;

        this.stickyObserver = new IntersectionObserver(
            this.#onStickyChange.bind(this),
            { threshold: 0, rootMargin: '-' + offset + 'px 0px 0px 0px' }
        );
        this.stickyObserver.observe(sentinel);
    }

    #onStickyChange(entries) {
        const dataTable = this.element.querySelector('.data-table');
        if (!dataTable || !(0 in entries)) {
            return;
        }

        if (entries[0].isIntersecting) {
            dataTable.classList.remove('data-table--stuck');
        } else {
            dataTable.classList.add('data-table--stuck');
        }
    }

    // Replace the native length <select> (whose option list cannot be themed by
    // the browser) with a Floating UI popup matching the filter button. The
    // DataTables select is never touched: the page length is driven through the
    // public API, so there is no conflict with the table's own change handling.
    #buildLengthDropdown(lengthMenu, currentLength) {
        const container = this.element.querySelector('.dt-length');
        if (!container) {
            return;
        }

        // The popup controller is registered under the same prefix as this one, whatever the
        // host chose in `mvincent_ui_kit.stimulus_prefix`.
        const popup = this.identifier.replace(/datatables$/, '') + 'popup';

        let items = '';
        for (let i = 0; i < lengthMenu.length; i++) {
            const length = lengthMenu[i];
            const activeClass = length === currentLength ? ' active' : '';
            items += '<li><button type="button" class="data-table-length__option'
                + activeClass + '" data-length="' + length + '"'
                + ' data-action="' + popup + '#close">' + length + '</button></li>';
        }

        container.classList.add('data-table-length');
        container.innerHTML =
            '<div class="data-table-length__control"'
            + ' data-controller="' + popup + '"'
            + ' data-' + popup + '-trigger-value="click"'
            + ' data-' + popup + '-strategy-value="fixed"'
            + ' data-' + popup + '-placement-value="bottom-start">'
            + '<button type="button" class="data-table-length__toggle"'
            + ' data-' + popup + '-target="trigger"'
            + ' data-action="' + popup + '#toggle" aria-haspopup="true" aria-expanded="false">'
            + '<span class="data-table-length__value">' + currentLength + '</span>'
            + '<i class="bi bi-chevron-down data-table-length__caret"></i>'
            + '</button>'
            + '<ul class="data-table-length__menu" data-' + popup + '-target="menu">' + items + '</ul>'
            + '</div>';

        this.#bindLengthOptions(container);
    }

    #bindLengthOptions(container) {
        const controller = this;
        const options = container.querySelectorAll('.data-table-length__option');
        const valueLabel = container.querySelector('.data-table-length__value');

        options.forEach(function (option) {
            option.addEventListener('click', function () {
                const length = parseInt(option.dataset.length, 10);
                controller.datatable.page.len(length).draw();
                valueLabel.textContent = length;

                options.forEach(function (item) {
                    item.classList.remove('active');
                });
                option.classList.add('active');
            });
        });
    }

    // Reveal the illustration overlay on top of the (possibly already populated)
    // table while a server request is in flight.
    #showLoader() {
        if (!this.hasLoaderTarget) {
            return;
        }

        this.loaderTarget.classList.remove('data-table-loader--hidden');
    }

    #hideLoader() {
        if (!this.hasLoaderTarget) {
            return;
        }

        // Cross-fade: reveal the table (opacity 0 -> 1) while the placeholder
        // overlay fades out on top of it.
        const frame = this.loaderTarget.closest('.data-table-frame');
        if (frame) {
            frame.classList.remove('data-table-frame--loading');
        }
        this.loaderTarget.classList.add('data-table-loader--hidden');
    }

    #refreshTable() {
        this.datatable.ajax.reload();
        this.tableTarget.dispatchEvent(new CustomEvent("dt.draw"));
    }

    filter() {
        let controller = this;
        controller.filterFieldTargets.forEach(function(item) {
            if (item.dataset.filterColumnName) {
                let columnIndex =  null;
                controller.tableTarget.querySelectorAll('th').forEach(function(th, index) {
                    if (columnIndex === null && th.dataset.columnName === item.dataset.filterColumnName) {
                        columnIndex = index;
                    }
                });

                if (columnIndex !== null) {
                    controller.datatable.columns(columnIndex).search(item.value);
                }
            }
        });

        controller.datatable.draw();
        this.tableTarget.dispatchEvent(new CustomEvent("dt.draw"));
    }

    multiSelect(event) {
        let mainCheckbox = event.currentTarget;

        this.multiSelectRowTargets?.forEach(function(checkbox) {
            checkbox.checked = mainCheckbox.checked;
        });

        this.#showMultiAction();

        this.tableTarget.dispatchEvent(
            new CustomEvent("dt.multi-select", { detail: {elements: this.multiSelectRowTargets}})
        );
    }

    singleSelect(event) {
        this.#showMultiAction();
        this.tableTarget.dispatchEvent(
            new CustomEvent("dt.multi-select", { detail: {elements: this.multiSelectRowTargets}})
        );
    }

    #showMultiAction() {
        if (this.hasMultiActionContainerTarget) {
            let hasOneChecked = false;
            let nbChecked = 0;
            this.multiSelectRowTargets.forEach(function (checkbox) {
                if (checkbox.checked) {
                    nbChecked++;
                    hasOneChecked = true;
                }
            });

            if (hasOneChecked) {
                this.multiActionContainerTarget.classList.remove('d-none');
                this.multiActionSelectCountTarget.innerText = nbChecked;
            } else {
                this.multiActionContainerTarget.classList.add('d-none');
                this.multiActionSelectCountTarget.innerText = '';
            }
        }
    }
}
