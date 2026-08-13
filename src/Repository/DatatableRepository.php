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

namespace MVincent\UiKitBundle\Repository;

use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\ORM\Tools\Pagination\Paginator;

/**
 * Used to managed AJAX Datatable request.
 * Class DatatableRepository.
 */
abstract class DatatableRepository extends ServiceEntityRepository
{
    public function formatResults(QueryBuilder $qb, array $orders, array $columns, int $draw): array
    {
        $columnsOrdered = array_map(fn (array $column): string => $column['data'], $columns);

        $arrayOrders = $this->getOrderingParts($columnsOrdered, $orders, $qb);
        foreach ($arrayOrders as $order) {
            $qb->addOrderBy($order['column'], $order['order']);
        }

        $paginator = new Paginator($qb);
        $data = $paginator->getQuery()->getResult();

        $orderedData = [];
        foreach ($data as $datum) {
            $orderedData[] = array_merge(array_flip($columnsOrdered), $datum);
        }

        return [
            'draw' => $draw,
            'recordsTotal' => count($orderedData),
            'recordsFiltered' => count($paginator),
            'data' => $orderedData,
        ];
    }

    /**
     * Get the ordering parts according to given orders fields.
     *
     * @param array<int, string>                          $columnsOrdered
     * @param array<int, array{column: int, dir: string}> $orders
     * @param QueryBuilder                                $qb
     *
     * @return array<int, array{column: string, order: string}>
     */
    private function getOrderingParts(array $columnsOrdered, array $orders, QueryBuilder $qb): array
    {
        $ordersArray = [];
        foreach ($orders as $order) {
            $field = $columnsOrdered[$order['column']] ?? null;

            $dir = strtoupper($order['dir']);
            if (!in_array($dir, ['ASC', 'DESC'], true)) {
                continue;
            }

            if (!empty($field) && $this->searchColumnInQb($qb, $field)) {
                $ordersArray[] = ['column' => $field, 'order' => $dir];
            }
        }

        return $ordersArray;
    }

    private function searchColumnInQb(QueryBuilder $qb, string $column): bool
    {
        $selects = $qb->getDQLPart('select');

        foreach ($selects as $select) {
            $selectString = (string) $select;

            if (preg_match('/\s+AS\s+(?P<alias>[a-zA-Z0-9_]+)/i', $selectString, $matches)) {
                $field = $matches['alias'];
            } else {
                $field = $selectString;
            }

            if ($field === $column) {
                return true;
            }
        }

        return false;
    }
}
