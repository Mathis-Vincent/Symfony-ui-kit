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

namespace App\Manager;

use App\DTO\CardList\ArticleCardListQuery;
use MVincent\UiKitBundle\DTO\Chart\ChartData;
use MVincent\UiKitBundle\DTO\Chart\ChartDataset;
use App\Repository\ArticleRepository;
use App\Service\Format\ArticleDataTableFormatter;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Where the logic lives for the three modules: it orchestrates the repository, the formatter and the
 * presentation enrichment, and returns a payload the controller only has to serialize.
 */
class ArticleManager
{
    public function __construct(
        private readonly ArticleRepository $articleRepository,
        private readonly ArticleDataTableFormatter $formatter,
        private readonly TranslatorInterface $translator,
    ) {
    }

    /**
     * @param array<int, array{column: int, dir: string}> $order
     * @param array<int, array{data: string}>             $columns
     * @param array{value?: string}                       $search
     *
     * @return array{draw: int, recordsTotal: int, recordsFiltered: int, data: array<int, array<string, mixed>>}
     */
    public function getDataForDatatable(
        int $start,
        int $length,
        int $draw,
        array $order,
        array $columns,
        array $search,
    ): array {
        $result = $this->articleRepository->getArticlesDataForDatatable($length, $start, $order, $draw, $columns, $search);
        $result['data'] = $this->formatter->formatRows($result['data']);

        return $result;
    }

    /**
     * Returns one ready-to-render card page. Side data must be loaded in batch, indexed by id, then
     * merged in a loop — never one query per card.
     *
     * @return array{items: array<int, array<string, mixed>>, total: int, totalAll: int, hasMore: bool}
     */
    public function getArticlesCardPage(ArticleCardListQuery $query): array
    {
        $page = $this->articleRepository->getArticlesCardPage($query);

        foreach ($page['items'] as $index => $item) {
            $item['readingTime'] = $this->translator->trans('article.card.reading_time', ['minutes' => $item['readingTime']]);
            $page['items'][$index] = $item;
        }

        $page['hasMore'] = !$query->loadAll && $query->page * $query->perPage < $page['total'];

        return $page;
    }

    /**
     * Builds the chart DTO: labels and data share the same order, and backgroundColor is only set
     * because the color carries business meaning here (each category owns its color).
     */
    public function getArticlesPerCategoryChart(): ChartData
    {
        $rows = $this->articleRepository->getArticleCountPerCategoryAsArray();

        $labels = [];
        $values = [];
        $colors = [];
        foreach ($rows as $row) {
            $labels[] = $row['name'];
            $values[] = $row['total'];
            $colors[] = $row['color'];
        }

        $title = $this->translator->trans('article.chart.per_category.series');

        return new ChartData($labels, [new ChartDataset($title, $values, $colors)]);
    }
}
