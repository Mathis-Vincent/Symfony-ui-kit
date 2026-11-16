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

namespace App\Controller;

use App\DTO\CardList\ArticleCardListQuery;
use MVincent\UiKitBundle\DTO\CardList\CardListQuery;
use App\Manager\ArticleManager;
use App\Repository\CategoryRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\Routing\Attribute\Route;

/**
 * The controller only transports: it reads the request parameters, hands them to the manager, then
 * builds the response. The only data handling tolerated here is URL generation, which depends on the
 * router.
 */
class ArticleController extends AbstractController
{
    #[Route('/articles', name: 'app_articles_list', methods: ['GET'])]
    public function list(ArticleManager $articleManager, CategoryRepository $categoryRepository): Response
    {
        return $this->render('pages/article/list.html.twig', [
            'categories' => $categoryRepository->findBy([], ['name' => 'ASC']),
            'articlesPerCategoryChart' => $articleManager->getArticlesPerCategoryChart(),
        ]);
    }

    #[Route('/articles-datatable', name: 'app_articles_list_datatable', methods: ['GET'])]
    public function listDatatable(
        ArticleManager $articleManager,
        #[MapQueryParameter] int $start = 0,
        #[MapQueryParameter] int $length = 0,
        #[MapQueryParameter] int $draw = 0,
        #[MapQueryParameter] array $order = [],
        #[MapQueryParameter] array $columns = [],
        #[MapQueryParameter] array $search = [],
    ): JsonResponse {
        $result = $articleManager->getDataForDatatable($start, $length, $draw, $order, $columns, $search);

        return new JsonResponse($result);
    }

    #[Route('/articles/cards', name: 'app_articles_cards', methods: ['GET'])]
    public function listCards(
        ArticleManager $articleManager,
        #[MapQueryParameter] string $search = '',
        #[MapQueryParameter] int $page = 1,
        #[MapQueryParameter] int $perPage = CardListQuery::DEFAULT_PER_PAGE,
        #[MapQueryParameter] bool $loadAll = false,
        #[MapQueryParameter] array $category = [],
    ): JsonResponse {
        $query = new ArticleCardListQuery($search, $page, $perPage, $loadAll, $category);
        $result = $articleManager->getArticlesCardPage($query);

        foreach ($result['items'] as $index => $item) {
            $result['items'][$index]['url'] = $this->generateUrl('app_article_detail', ['id' => $item['id']]);
        }

        return new JsonResponse([
            'items' => array_values($result['items']),
            'hasMore' => $result['hasMore'],
            'total' => $result['total'],
            'totalAll' => $result['totalAll'],
            'page' => $query->page,
        ]);
    }
}
