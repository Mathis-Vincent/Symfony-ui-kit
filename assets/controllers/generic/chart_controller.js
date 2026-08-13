import {BaseController} from "../base/base_controller";
import * as Sentry from "@sentry/browser";
import axios from "axios";
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

Chart.defaults.font.family = getComputedStyle(document.documentElement)
    .getPropertyValue('--bs-font-sans-serif');

const DEFAULT_TYPE = 'pie';
const LEGEND_ITEM_LIMIT = 8;
const HEX_RADIX = 16;
const HEX_LENGTH = 6;
const RANDOM_COLOR_MAX = 0xffffff;

export default class extends BaseController {
    static targets = [ 'graph', 'legend', 'loader' ];

    chart = null;

    connect() {
        super.connect();

        const dataset = this.graphTarget.dataset;
        if (dataset.urlPopulate) {
            this.#loadFromUrl(dataset.urlPopulate);

            return;
        }

        if (dataset.json && dataset.json.length > 0) {
            let data;
            try {
                data = JSON.parse(dataset.json);
            } catch (error) {
                Sentry.captureException(error);
                this.showErrorHappened();

                return;
            }

            this.#buildChart(data);

            return;
        }

        Sentry.captureMessage('No data-url-populate nor data-json found on the chart element');
        this.showErrorHappened();
    }

    disconnect() {
        if (this.chart !== null) {
            this.chart.destroy();
            this.chart = null;
        }

        if (this.hasLegendTarget) {
            this.legendTarget.replaceChildren();
        }

        super.disconnect();
    }

    #loadFromUrl(url) {
        axios
            .get(url)
            .then((response) => {
                if (typeof response.data !== 'object') {
                    throw Error('Data from ' + url + ' is not an Object');
                }

                if (!response.data.labels || response.data.labels.length === 0
                    || !response.data.datasets || response.data.datasets.length === 0) {
                    this.#hideLoader();

                    return;
                }

                this.#buildChart(response.data);
            })
            .catch((error) => {
                Sentry.captureException(error);
                this.#hideLoader();
            });
    }

    #buildChart(data) {
        const type = this.graphTarget.dataset.type || DEFAULT_TYPE;
        const datasets = this.#withColors(data.labels, data.datasets);
        const useHtmlLegend = this.#useHtmlLegend(data.labels);

        const config = {
            type: type,
            data: {
                labels: data.labels,
                datasets: datasets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: useHtmlLegend,
                plugins: {
                    legend: {
                        display: !useHtmlLegend,
                    },
                },
            },
        };

        this.chart = new Chart(this.graphTarget, config);
        this.#hideLoader();

        if (useHtmlLegend) {
            this.#renderHtmlLegend(this.chart);
        }
    }

    // The HTML legend is opt-in (data-html-legend) but also kicks in automatically
    // when there are more labels than the native legend can display comfortably.
    #useHtmlLegend(labels) {
        if (!this.hasLegendTarget) {
            return false;
        }

        if (this.graphTarget.dataset.htmlLegend) {
            return true;
        }

        return labels.length > LEGEND_ITEM_LIMIT;
    }

    // Assign presentation colors to every dataset that does not already carry its
    // own backgroundColor (the DTO can therefore override the palette). When the
    // template declares a palette (data-colors) each slice picks a color from it,
    // otherwise a pure random color is generated per slice.
    #withColors(labels, datasets) {
        const palette = this.#readPalette();
        const result = [];

        for (let i = 0; i < datasets.length; i++) {
            const dataset = datasets[i];
            if (dataset.backgroundColor && dataset.backgroundColor.length > 0) {
                result.push(dataset);

                continue;
            }

            const colors = [];
            for (let j = 0; j < labels.length; j++) {
                colors.push(this.#pickColor(palette));
            }

            dataset.backgroundColor = colors;
            result.push(dataset);
        }

        return result;
    }

    #readPalette() {
        const raw = this.graphTarget.dataset.colors;
        if (!raw) {
            return [];
        }

        try {
            const parsed = JSON.parse(raw);

            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            Sentry.captureException(error);

            return [];
        }
    }

    #pickColor(palette) {
        if (palette.length > 0) {
            const index = Math.floor(Math.random() * palette.length);

            return palette[index];
        }

        const value = Math.floor(Math.random() * (RANDOM_COLOR_MAX + 1));

        return '#' + value.toString(HEX_RADIX).padStart(HEX_LENGTH, '0');
    }

    #hideLoader() {
        if (this.hasLoaderTarget) {
            this.loaderTarget.classList.add('chart-loader--hidden');
        }
    }

    #renderHtmlLegend(chart) {
        const container = this.legendTarget;
        container.replaceChildren();
        const list = document.createElement('ul');
        list.className = 'chart-legend__list';

        const items = chart.options.plugins.legend.labels.generateLabels(chart);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const li = document.createElement('li');
            li.className = 'chart-legend__item';

            const colorBox = document.createElement('span');
            colorBox.className = 'chart-legend__color';
            colorBox.style.backgroundColor = item.fillStyle;

            const label = document.createElement('span');
            label.className = 'chart-legend__label';
            label.textContent = item.text;

            li.appendChild(colorBox);
            li.appendChild(label);

            li.addEventListener('click', () => {
                chart.toggleDataVisibility(item.index);
                chart.update();
                this.#updateLegendStates(chart, list);
            });

            list.appendChild(li);
        }

        container.appendChild(list);
    }

    #updateLegendStates(chart, list) {
        const items = list.querySelectorAll('.chart-legend__item');

        for (let i = 0; i < items.length; i++) {
            const visible = chart.getDataVisibility(i);
            items[i].classList.toggle('chart-legend__item--hidden', !visible);
        }
    }
}
