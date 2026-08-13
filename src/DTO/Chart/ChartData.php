<?php

declare(strict_types=1);

/*
 *
 * (c) MVincent <vmathis934@gmail.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 *
 */

namespace MVincent\UiKitBundle\DTO\Chart;

readonly class ChartData implements \JsonSerializable
{
    /**
     * @param string[]       $labels
     * @param ChartDataset[] $datasets
     */
    public function __construct(
        public array $labels,
        public array $datasets,
    ) {
    }

    /**
     * @return array{labels: string[], datasets: ChartDataset[]}
     */
    public function jsonSerialize(): array
    {
        return [
            'labels' => $this->labels,
            'datasets' => $this->datasets,
        ];
    }
}
