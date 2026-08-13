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

namespace App\Service\Format;

use App\Entity\Article;
use App\Repository\ArticleRepository;
use MVincent\UiKitBundle\Service\Format\AbstractDataTableRowFormatter;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;
use Twig\Environment;

/**
 * Dresses each DataTables row in HTML. Extending AbstractDataTableRowFormatter gives the batch
 * loading of the row targets for free, so per-row authorization costs no extra query.
 */
class ArticleDataTableFormatter extends AbstractDataTableRowFormatter
{
    private const string ID_KEY = 'aid';
    private const string DATE_FORMAT = 'd/m/Y H:i';

    public function __construct(
        private readonly ArticleRepository $articleRepository,
        private readonly UrlGeneratorInterface $urlGenerator,
        private readonly AuthorizationCheckerInterface $authorizationChecker,
        private readonly Environment $twig,
    ) {
    }

    protected function getIdKey(): string
    {
        return self::ID_KEY;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     *
     * @return array<int, object>
     */
    protected function loadTargets(array $rows): array
    {
        $ids = [];
        foreach ($rows as $row) {
            $ids[] = (int) $row[self::ID_KEY];
        }

        if ([] === $ids) {
            return [];
        }

        $targets = [];
        foreach ($this->articleRepository->findBy(['id' => $ids]) as $article) {
            $targets[(int) $article->getId()] = $article;
        }

        return $targets;
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    protected function formatRow(array $row, ?object $target): array
    {
        $canShow = $target instanceof Article && $this->authorizationChecker->isGranted('view', $target);

        $row['title'] = $canShow
            ? $this->twig->render('dataTable/generic/link.html.twig', [
                'url' => $this->urlGenerator->generate('app_article_detail', ['id' => $row[self::ID_KEY]]),
                'text' => $row['title'],
            ])
            : $this->twig->render('dataTable/generic/text.html.twig', ['text' => $row['title']]);

        $row['category'] = $this->twig->render('dataTable/generic/text.html.twig', ['text' => $row['category']]);

        if ($row['published_at'] instanceof \DateTimeInterface) {
            $row['published_at'] = $row['published_at']->format(self::DATE_FORMAT);
        }

        return $row;
    }
}
