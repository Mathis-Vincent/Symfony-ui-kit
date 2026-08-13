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

namespace MVincent\UiKitBundle\Repository\Trait;

use MVincent\UiKitBundle\DTO\CardList\CardListQuery;
use Doctrine\ORM\QueryBuilder;

/**
 * Reusable building blocks for card-list repositories: a case-insensitive search
 * filter spread over several fields and a page-based limit/offset. Kept as a trait
 * so any repository can use it regardless of the parent class it already extends.
 */
trait CardListQueryTrait
{
    /**
     * Adds a case-insensitive LIKE filter, OR-combined over the given DQL fields.
     * A blank search or an empty field list leaves the query untouched.
     *
     * @param string[]     $fields    DQL field expressions, e.g. ['s.name']
     * @param QueryBuilder $qb
     * @param string       $search
     * @param string       $parameter
     */
    protected function applyCardListSearch(
        QueryBuilder $qb,
        string $search,
        array $fields,
        string $parameter = 'cardListSearch'
    ): void {
        $search = trim($search);
        if ('' === $search || [] === $fields) {
            return;
        }

        $orX = $qb->expr()->orX();
        foreach ($fields as $field) {
            $orX->add(sprintf('LOWER(%s) LIKE :%s', $field, $parameter));
        }

        $qb
            ->andWhere($orX)
            ->setParameter($parameter, '%'.mb_strtolower($search).'%');
    }

    protected function applyCardListPagination(QueryBuilder $qb, int $page, int $perPage): void
    {
        if ($page < 1) {
            $page = 1;
        }
        if ($perPage < 1) {
            $perPage = CardListQuery::DEFAULT_PER_PAGE;
        }

        $qb
            ->setFirstResult(($page - 1) * $perPage)
            ->setMaxResults($perPage);
    }
}
