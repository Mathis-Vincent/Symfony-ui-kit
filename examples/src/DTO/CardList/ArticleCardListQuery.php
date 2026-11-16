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

namespace App\DTO\CardList;

use MVincent\UiKitBundle\DTO\CardList\CardListQuery;

/**
 * How to carry business filters on a card list: extend the generic query and declare one typed
 * property per filter, each normalized in the constructor so the manager and the repository always
 * receive an already validated value.
 */
readonly class ArticleCardListQuery extends CardListQuery
{
    /** @var list<int> */
    public array $categoryIds;

    public function __construct(
        string $search = '',
        int $page = 1,
        int $perPage = self::DEFAULT_PER_PAGE,
        bool $loadAll = false,
        array $categoryIds = [],
    ) {
        parent::__construct($search, $page, $perPage, $loadAll);

        // Multiple filter (`category[]`): keep positive ids only, without duplicates. `filter_var`
        // rejects a nested array (`category[0][]=5`) that a cast would turn into 1.
        $ids = [];
        foreach ($categoryIds as $categoryId) {
            $id = filter_var($categoryId, \FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if (false !== $id) {
                $ids[$id] = $id;
            }
        }
        $this->categoryIds = array_values($ids);
    }
}
