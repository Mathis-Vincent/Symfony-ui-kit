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

readonly class ChartDataset implements \JsonSerializable
{
    /**
     * @param int[]    $data
     * @param string[] $backgroundColor per-slice colors; when empty the presentation layer assigns them
     * @param string   $label
     */
    public function __construct(
        public string $label,
        public array $data,
        public array $backgroundColor = [],
    ) {
    }

    /**
     * @return array{label: string, data: int[], backgroundColor?: string[]}
     */
    public function jsonSerialize(): array
    {
        $result = [
            'label' => $this->label,
            'data' => $this->data,
        ];

        if ([] !== $this->backgroundColor) {
            $result['backgroundColor'] = $this->backgroundColor;
        }

        return $result;
    }
}
