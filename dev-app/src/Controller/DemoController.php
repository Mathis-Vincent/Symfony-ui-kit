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

namespace MVincent\UiKitBundle\DevApp\Controller;

use MVincent\UiKitBundle\DTO\Chart\ChartData;
use MVincent\UiKitBundle\DTO\Chart\ChartDataset;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Serves the three modules over an in-memory dataset.
 *
 * No database, no Doctrine: the point is to see and tweak the Twig layouts, the Stimulus
 * controllers and the SCSS, not to demonstrate persistence. The JSON endpoints reproduce
 * the exact contracts the front expects, so what renders here renders in a real project.
 */
class DemoController extends AbstractController
{
    private const array CATEGORIES = ['Symfony', 'Frontend', 'DevOps', 'Design'];

    private const array TAGS = ['PHP', 'Symfony', 'Twig', 'Stimulus', 'SCSS'];

    /** Published by `assets:install`, so the media zone points at a real file. */
    private const string MEDIA_IMAGE = '/bundles/mvincentuikit/images/loading/cards-coming-soon.svg';

    #[Route('/', name: 'demo_home', methods: ['GET'])]
    public function home(): Response
    {
        return $this->render('demo/index.html.twig');
    }

    // -- DataTables ---------------------------------------------------------

    #[Route('/datatable', name: 'demo_datatable', methods: ['GET'])]
    public function datatable(): Response
    {
        return $this->render('demo/datatable.html.twig', ['categories' => self::CATEGORIES]);
    }

    /**
     * Server-side DataTables endpoint: same request/response contract as
     * `MVincent\UiKitBundle\Repository\DatatableRepository`, applied to an array.
     */
    #[Route('/datatable/data', name: 'demo_datatable_data', methods: ['GET'])]
    public function datatableData(
        #[MapQueryParameter] int $start = 0,
        #[MapQueryParameter] int $length = 10,
        #[MapQueryParameter] int $draw = 0,
        #[MapQueryParameter] array $order = [],
        #[MapQueryParameter] array $columns = [],
        #[MapQueryParameter] array $search = [],
    ): JsonResponse {
        $rows = $this->rows();
        $recordsTotal = \count($rows);

        $term = mb_strtolower(trim((string) ($search['value'] ?? '')));
        if ('' !== $term) {
            $rows = array_values(array_filter(
                $rows,
                static fn (array $row): bool => str_contains(mb_strtolower($row['title'].' '.$row['category']), $term),
            ));
        }

        // The hidden `filter_category` column carries the filter value (see the layout doc).
        foreach ($columns as $column) {
            if ('filter_category' === ($column['data'] ?? null) && '' !== ($column['search']['value'] ?? '')) {
                $category = $column['search']['value'];
                $rows = array_values(array_filter($rows, static fn (array $row): bool => $row['category'] === $category));
            }
        }

        $orderColumn = $columns[$order[0]['column'] ?? 0]['data'] ?? 'title';
        $direction = 'desc' === strtolower($order[0]['dir'] ?? 'asc') ? -1 : 1;
        usort($rows, static fn (array $a, array $b): int => $direction * ($a[$orderColumn] <=> $b[$orderColumn]));

        $recordsFiltered = \count($rows);
        $page = $length > 0 ? \array_slice($rows, $start, $length) : $rows;

        // A real project renders its cells through a formatter; here plain HTML is enough.
        $data = array_map(static fn (array $row): array => [
            'title' => sprintf('<a href="#" class="data-table__link">%s</a>', htmlspecialchars($row['title'])),
            'category' => htmlspecialchars($row['category']),
            'views' => number_format($row['views'], 0, ',', ' '),
            'published_at' => $row['published_at'],
            'filter_category' => '',
        ], $page);

        return new JsonResponse([
            'draw' => $draw,
            'recordsTotal' => $recordsTotal,
            'recordsFiltered' => $recordsFiltered,
            'data' => $data,
        ]);
    }

    // -- CardList -----------------------------------------------------------

    #[Route('/card-list', name: 'demo_card_list', methods: ['GET'])]
    public function cardList(): Response
    {
        return $this->render('demo/card_list.html.twig', ['categories' => self::CATEGORIES]);
    }

    #[Route('/card-list/data', name: 'demo_card_list_data', methods: ['GET'])]
    public function cardListData(
        #[MapQueryParameter] string $search = '',
        #[MapQueryParameter] int $page = 1,
        #[MapQueryParameter] int $perPage = 12,
        #[MapQueryParameter] bool $loadAll = false,
        #[MapQueryParameter] ?string $category = null,
    ): JsonResponse {
        $rows = $this->rows();
        $totalAll = \count($rows);

        $term = mb_strtolower(trim($search));
        if ('' !== $term) {
            $rows = array_values(array_filter(
                $rows,
                static fn (array $row): bool => str_contains(mb_strtolower($row['title']), $term),
            ));
        }

        if (null !== $category && '' !== $category) {
            $rows = array_values(array_filter($rows, static fn (array $row): bool => $row['category'] === $category));
        }

        $total = \count($rows);
        $items = $loadAll ? $rows : \array_slice($rows, ($page - 1) * $perPage, $perPage);

        $items = array_map(static fn (array $row): array => [
            'id' => $row['id'],
            'title' => $row['title'],
            'category' => $row['category'],
            'views' => number_format($row['views'], 0, ',', ' '),
            'comments' => (string) $row['comments'],
            'image' => $row['image'],
            'excerpt' => $row['excerpt'],
            'badge' => $row['category'],
            'badgeVariant' => mb_strtolower($row['category']),
            'tags' => $row['tags'],
            'url' => '#',
        ], $items);

        return new JsonResponse([
            'items' => array_values($items),
            'hasMore' => !$loadAll && ($page * $perPage) < $total,
            'total' => $total,
            'totalAll' => $totalAll,
            'page' => $page,
        ]);
    }

    // -- Chart --------------------------------------------------------------

    #[Route('/chart', name: 'demo_chart', methods: ['GET'])]
    public function chart(): Response
    {
        $counts = array_fill_keys(self::CATEGORIES, 0);
        foreach ($this->rows() as $row) {
            ++$counts[$row['category']];
        }

        $chart = new ChartData(
            labels: array_keys($counts),
            datasets: [new ChartDataset(
                label: 'Articles par catégorie',
                data: array_values($counts),
                backgroundColor: ['#1E3A8A', '#10B981', '#FBBF24', '#0F172A'],
            )],
        );

        return $this->render('demo/chart.html.twig', ['chart' => $chart]);
    }

    /**
     * Deterministic dataset, big enough to exercise pagination and « load more ».
     *
     * @return list<array{id: int, title: string, category: string, views: int, comments: int, published_at: string, image: string, excerpt: string, tags: list<string>}>
     */
    private function rows(): array
    {
        $rows = [];
        for ($i = 1; $i <= 47; ++$i) {
            $category = self::CATEGORIES[$i % \count(self::CATEGORIES)];

            $rows[] = [
                'id' => $i,
                'title' => sprintf('Article de démonstration n°%02d', $i),
                'category' => $category,
                'views' => ($i * 137) % 9000 + 100,
                'comments' => $i % 13,
                'published_at' => sprintf('2026-%02d-%02d', ($i % 12) + 1, ($i % 28) + 1),
                'image' => self::MEDIA_IMAGE,
                'excerpt' => sprintf('Résumé de démonstration n°%02d, assez long pour occuper plusieurs lignes.', $i),
                'tags' => \array_slice(self::TAGS, 0, ($i % 4) + 2),
            ];
        }

        return $rows;
    }
}
