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

namespace MVincent\UiKitBundle\DTO\CardList;

/**
 * Immutable card list request, normalized at construction time so that neither the manager nor the
 * repository ever has to clamp a value.
 *
 * Business filters are not part of this generic contract: extend this class and declare one typed,
 * constructor-normalized property per filter (see examples/src/DTO/CardList/ArticleCardListQuery.php).
 */
readonly class CardListQuery
{
    public const int DEFAULT_PER_PAGE = 12;
    public const int MAX_PER_PAGE = 60;

    public string $search;
    public int $page;
    public int $perPage;
    public bool $loadAll;

    public function __construct(
        string $search = '',
        int $page = 1,
        int $perPage = self::DEFAULT_PER_PAGE,
        bool $loadAll = false,
    ) {
        $this->search = trim($search);
        $this->page = max(1, $page);
        $this->perPage = min(self::MAX_PER_PAGE, max(1, $perPage));
        $this->loadAll = $loadAll;
    }
}
