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

namespace App\Repository;

use App\DTO\CardList\ArticleCardListQuery;
use App\Entity\Article;
use MVincent\UiKitBundle\Repository\DatatableRepository;
use MVincent\UiKitBundle\Repository\Trait\CardListQueryTrait;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;

/**
 * One repository wired for the three modules: DataTables (via the DatatableRepository base class),
 * CardList (via the CardListQueryTrait) and Chart (a plain aggregated result).
 */
class ArticleRepository extends DatatableRepository
{
    use CardListQueryTrait;

    private const array CARD_LIST_SEARCH_FIELDS = ['a.title', 'c.name'];

    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Article::class);
    }

    /**
     * Builds the DataTables page: one SQL alias per column name, global search, then the assembly is
     * delegated to formatResults() which handles the safe ordering and the pagination count.
     *
     * @param array<int, array{column: int, dir: string}> $orders
     * @param array<int, array{data: string}>             $columns
     * @param array{value?: string}                       $search
     *
     * @return array{draw: int, recordsTotal: int, recordsFiltered: int, data: array<int, array<string, mixed>>}
     */
    public function getArticlesDataForDatatable(
        int $limit,
        int $start,
        array $orders,
        int $draw,
        array $columns,
        array $search = [],
    ): array {
        $qb = $this
            ->createQueryBuilder('a')
            ->innerJoin('a.category', 'c')
            ->select('a.title AS title')
            ->addSelect('c.name AS category')
            ->addSelect('a.views AS views')
            ->addSelect('a.publishedAt AS published_at')
            ->addSelect('a.id AS aid');

        if (isset($search['value']) && '' !== trim($search['value'])) {
            $qb
                ->andWhere('LOWER(a.title) LIKE LOWER(:search)')
                ->setParameter('search', '%'.trim($search['value']).'%');
        }

        $qb
            ->setMaxResults($limit)
            ->setFirstResult($start);

        return $this->formatResults($qb, $orders, $columns, $draw);
    }

    /**
     * Builds one card-list page. `total` counts the current search (it bounds the pagination and
     * hasMore), `totalAll` counts the whole perimeter (the "X of N" counter).
     *
     * When the item query aggregates (GROUP BY), split it in two passes — page ids first, then the
     * aggregates restricted to those ids — so the LIMIT never applies to join-duplicated rows.
     *
     * @return array{items: array<int, array<string, mixed>>, total: int, totalAll: int}
     */
    public function getArticlesCardPage(ArticleCardListQuery $query): array
    {
        $total = $this->countArticles($query, $query->search);
        $totalAll = '' === $query->search ? $total : $this->countArticles($query, '');
        if (0 === $total) {
            return ['items' => [], 'total' => 0, 'totalAll' => $totalAll];
        }

        $qb = $this
            ->createQueryBuilder('a')
            ->innerJoin('a.category', 'c')
            ->select('a.id AS id')
            ->addSelect('a.title AS title')
            ->addSelect('a.views AS views')
            ->addSelect('a.readingTime AS readingTime')
            ->addSelect('c.name AS categoryName')
            ->orderBy('a.publishedAt', 'DESC');

        $this->applyCategoryFilter($qb, $query->categoryId);
        $this->applyCardListSearch($qb, $query->search, self::CARD_LIST_SEARCH_FIELDS);
        if (!$query->loadAll) {
            $this->applyCardListPagination($qb, $query->page, $query->perPage);
        }

        return [
            'items' => $qb->getQuery()->getArrayResult(),
            'total' => $total,
            'totalAll' => $totalAll,
        ];
    }

    /**
     * Raw aggregated rows for the chart: the repository knows nothing about charts, and the ordering
     * is a data decision, so it is done in SQL.
     *
     * @return array<int, array{total: int, name: string, color: string}>
     */
    public function getArticleCountPerCategoryAsArray(): array
    {
        return $this
            ->createQueryBuilder('a')
            ->innerJoin('a.category', 'c')
            ->select('count(a.id) AS total')
            ->addSelect('c.name AS name')
            ->addSelect('c.color AS color')
            ->groupBy('c.id')
            ->orderBy('total', 'DESC')
            ->getQuery()
            ->getArrayResult();
    }

    private function countArticles(ArticleCardListQuery $query, string $search): int
    {
        $qb = $this
            ->createQueryBuilder('a')
            ->innerJoin('a.category', 'c')
            ->select('count(a.id)');

        $this->applyCategoryFilter($qb, $query->categoryId);
        $this->applyCardListSearch($qb, $search, self::CARD_LIST_SEARCH_FIELDS);

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    private function applyCategoryFilter(QueryBuilder $qb, ?int $categoryId): void
    {
        if (null === $categoryId) {
            return;
        }

        $qb
            ->andWhere('c.id = :categoryId')
            ->setParameter('categoryId', $categoryId);
    }
}
