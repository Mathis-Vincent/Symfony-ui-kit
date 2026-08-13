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
    public ?int $categoryId;

    public function __construct(
        string $search = '',
        int $page = 1,
        int $perPage = self::DEFAULT_PER_PAGE,
        bool $loadAll = false,
        ?int $categoryId = null,
    ) {
        parent::__construct($search, $page, $perPage, $loadAll);

        $this->categoryId = (null !== $categoryId && $categoryId > 0) ? $categoryId : null;
    }
}
