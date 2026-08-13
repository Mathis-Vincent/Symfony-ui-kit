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

namespace MVincent\UiKitBundle\Service\Format;

/**
 * Shared skeleton for DataTable row formatters that resolve a per-row target entity (by id) so the
 * concrete formatter can render each cell according to the actor's authorization on that target.
 */
abstract class AbstractDataTableRowFormatter
{
    /**
     * Post-processes datatable rows: resolves the target entity of each row, then delegates the
     * display formatting (including per-row authorization) to the concrete formatter.
     *
     * @param array<int, array<string, mixed>> $rows
     *
     * @return array<int, array<string, mixed>>
     */
    public function formatRows(array $rows): array
    {
        $targets = $this->loadTargets($rows);

        $formatted = [];
        foreach ($rows as $key => $row) {
            $target = $targets[(int) $row[$this->getIdKey()]] ?? null;
            $formatted[$key] = $this->formatRow($row, $target);
        }

        return $formatted;
    }

    /** Row key holding the target entity id (e.g. "cid", "sid", "user_id"). */
    abstract protected function getIdKey(): string;

    /**
     * Loads the listed targets indexed by their id, so per-row authorization can be evaluated.
     *
     * @param array<int, array<string, mixed>> $rows
     *
     * @return array<int, object>
     */
    abstract protected function loadTargets(array $rows): array;

    /**
     * @param array<string, mixed> $row
     * @param ?object              $target
     *
     * @return array<string, mixed>
     */
    abstract protected function formatRow(array $row, ?object $target): array;
}
