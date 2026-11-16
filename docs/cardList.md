# Module CardList

Ce guide décrit un module CardList **server-side** complet et portable : un socle
que l'on copie une seule fois, puis un plan de câblage à répéter pour chaque nouvelle
liste. L'objectif est d'obtenir une liste de cartes recherchée / filtrée / paginée
(« charger plus ») **opérationnelle avec le minimum de code par page**.

C'est l'extention « cartes » du module DataTables (`datatables.md`) : là où DataTables
rend un tableau, CardList rend une grille de cartes. Les deux partagent la même
philosophie — le template **déclare**, le contrôleur JS **consomme**, le back **répond
en JSON** — mais CardList construit chaque carte côté client à partir d'un prototype
`<template>`, sans formatter HTML côté serveur.

## 1. Architecture en 5 couches

Une liste de cartes repose sur cinq couches, chacune avec une responsabilité unique :

| Couche | Fichier de référence | Rôle |
|---|---|---|
| **Template Twig** | `@MVincentUiKit/cardList/layout.html.twig` | Déclare la grille, le prototype de carte (titre, sous-titre, lignes de stats) et la configuration via des `{% set %}` / blocs. C'est ce template qu'une page **étend**. |
| **Contrôleur Stimulus** | `assets/controllers/generic/card_list_controller.js` | Lit la config depuis les `data-*`, appelle en AJAX la route, construit chaque carte depuis le `<template>`, gère recherche / filtres / « charger plus » / « tout charger ». |
| **Contrôleur PHP** | ex. `Controller/SiteController.php` | Route GET qui reçoit les paramètres via `#[MapQueryParameter]`, construit un `CardListQuery`, le transmet au manager, puis construit la `JsonResponse`. Aucune logique métier (hors droits / génération d'URL). |
| **Manager PHP** | ex. `Manager/SiteManager.php` | Orchestre la fonctionnalité : résout le périmètre / les droits, appelle le repository, enrichit chaque item, calcule `hasMore`, et renvoie la page prête. C'est ici que vit la logique. |
| **Repository PHP** | `Repository/Trait/CardListQueryTrait.php` (socle) + repo concret | Construit la requête (recherche + filtres + pagination) et assemble la page `{items, total, totalAll}`. |

Le flux : le template **déclare** la config → le layout la **traduit** en attributs HTML →
le contrôleur JS la **consomme** et appelle en AJAX la route PHP → le contrôleur **construit
le `CardListQuery`** et le transmet au manager → le manager **orchestre** (périmètre +
repository + enrichissement + `hasMore`) → le repository **répond** avec
`{items, total, totalAll}` →
le contrôleur JS **clone** le prototype `<template>` pour chaque item et remplit ses champs.

## 2. Contenu du module

### Socle réutilisable (fourni par le bundle, rien à copier)

Ces fichiers sont **génériques** : ils vivent dans le bundle `mathis-vincent/symfony-ui-kit`,
ne connaissent aucune entité et se partagent
d'un projet à l'autre sans modification.

- `@MVincentUiKit/cardList/layout.html.twig` — le layout de liste étendable (prototype de
  carte + toolbar + grille + pied de page).
- `assets/controllers/generic/card_list_controller.js` — le contrôleur Stimulus.
- `src/DTO/CardList/CardListQuery.php` — la requête immuable (normalise search / page /
  perPage / loadAll / customerId).
- `src/Repository/Trait/CardListQueryTrait.php` — les briques réutilisables :
  `applyCardListSearch()` (LIKE insensible à la casse, OR sur plusieurs champs) et
  `applyCardListPagination()` (limit / offset).
- Les styles `assets/styles/modules/card-list/*.scss` (BEM `card-list__*`), découpés en
  partials importés par `_card-list.scss` : `_layout.scss` (grille + états), `_toolbar.scss`
  (recherche / filtre / compteur), `_card.scss` (carte, en-tête, sous-titre) et
  `_stats.scss` (lignes de stats, icônes, positions de valeur).
- L'illustration de chargement `public/images/loading/cards-coming-soon.svg`, servie
  à la fois en overlay de rechargement complet (`placeholder`) et en pied de « charger plus »
  (`more-loader`). Voir §13.
- Les clés de traduction sous le domaine `cardList` (`translations/cardList+intl-icu.fr.yaml`).

### Prérequis (dépendances front)

Le contrôleur Stimulus étend `BaseController` et s'appuie sur :

```js
import { BaseController } from "../base/base_controller";
import { translate } from "../../translator";
import * as Sentry from "@sentry/browser";
```

Le filtre optionnel réutilise le contrôleur `generic--offcanvas` (panneau latéral) déjà
présent dans le socle DataTables.

### À créer pour chaque liste

1. Un **template** qui étend `cardList/layout.html.twig` (config + prototype de carte).
2. Une **route GET** dans un contrôleur qui construit un `CardListQuery` et le transmet
   au manager, puis renvoie la `JsonResponse`.
3. Une **méthode de manager** qui orchestre périmètre / droits / repository / enrichissement.
4. Une **méthode de repository** `getXxxCardPage(...)` utilisant le `CardListQueryTrait`.

## 3. Le contrat front ↔ back

C'est le cœur du module : front et back se parlent avec les **noms de champs**
(`data-row-name` / `cl_title_field` / `data-field` du sous-titre côté HTML = clés des objets
`items` côté JSON).

**Requête** (paramètres GET, envoyés par le contrôleur) :

| Paramètre | Type | Contenu |
|---|---|---|
| `search` | string | Terme de recherche global (vide si aucun). |
| `page` | int | Page courante, 1-based. |
| `perPage` | int | Nombre de cartes par page. |
| `loadAll` | `'1'`? | Présent uniquement quand « tout charger » est cliqué : la pagination est abandonnée. |
| *(un par filtre)* | string \| string[] | Une clé par `data-filter-param` déclaré (ex. `customer`) ; les valeurs vides sont omises. Un filtre multiple (`<select multiple>`) part en paramètres répétés `param[]` (ex. `tag[]=a&tag[]=b`), reçus en `array` côté Symfony. |

**Réponse** (JSON) :

```json
{
  "items": [
    { "id": 12, "name": "...", "externalId": 4, "nbGateway": 3, "url": "/sites/12" }
  ],
  "hasMore": true,
  "total": 42,
  "totalAll": 60,
  "page": 1
}
```

- `items` : chaque objet a pour clés les noms de champs déclarés (`cl_title_field`, chaque
  `data-field` du sous-titre, chaque `data-row-name`) plus, si la liste est cliquable, une clé
  `url` (le contrôleur enveloppe alors la carte dans un `<a href>`).
- `hasMore` : booléen pilotant l'affichage des boutons « charger plus » / « tout charger ».
  Il est **calculé par le manager** et simplement relayé par le contrôleur (cf. §4.2 / §4.4).
- `total` : nombre d'éléments correspondant à la **recherche courante** (borne la pagination).
- `totalAll` : nombre d'éléments du **périmètre entier** (sert au compteur « X sur N »).
- `page` : la page renvoyée (écho).

## 4. Exemple minimal complet

### 4.1 Template (`templates/pages/xxx/list.html.twig`)

```twig
{% extends "@MVincentUiKit/cardList/layout.html.twig" %}

{% set cl_url = path('app_sites_cards') %}
{% set cl_title_field = 'name' %}

{% block cl_rows %}
    <li data-row-name="nbGateway" data-row-icon="vinyl-fill">{{ 'site.card.row.gateways'|trans }}</li>
    <li data-row-name="nbTotalTags" data-row-icon="tags-fill">{{ 'site.card.row.tags'|trans }}</li>
{% endblock cl_rows %}
```

Seul `cl_url` est réellement obligatoire : sans lui, le contrôleur n'a aucune route à
interroger. Le bloc `cl_rows` définit les lignes de stats de chaque carte.

### 4.2 Route (contrôleur PHP)

Le contrôleur ne fait que **transporter** : il reçoit les paramètres via
`#[MapQueryParameter]`, construit un `CardListQuery`, le transmet au manager, puis
construit la `JsonResponse`. La seule manipulation tolérée ici est la génération des URLs
de destination (droits par ligne / routage), qui dépend du routeur.

```php
#[Route('/sites/cards', name: 'app_sites_cards', methods: ['GET'])]
public function sitesListCards(
    SiteManager $siteManager,
    #[MapQueryParameter] string  $search   = '',
    #[MapQueryParameter] int     $page     = 1,
    #[MapQueryParameter] int     $perPage  = CardListQuery::DEFAULT_PER_PAGE,
    #[MapQueryParameter] bool    $loadAll  = false,
    #[MapQueryParameter] ?int    $customer = null,
    #[MapQueryParameter] ?string $type     = null,
): JsonResponse {
    /** @var User $user */
    $user = $this->getUser();

    $query  = new CardListQuery($search, $page, $perPage, $loadAll, $customer, $type);
    $result = $siteManager->getSitesCardPage(
        $user,
        $query,
        [MarketingOperationState::Pending, MarketingOperationState::Accepted]
    );

    foreach ($result['items'] as $index => $item) {
        $result['items'][$index]['url'] = $this->generateUrl('app_customer_site_detail', ['site' => $item['id']]);
    }

    return new JsonResponse([
        'items'    => array_values($result['items']),
        'hasMore'  => $result['hasMore'],
        'total'    => $result['total'],
        'totalAll' => $result['totalAll'],
        'page'     => $query->page,
    ]);
}
```

**Règle `hasMore`** : `true` tant qu'on n'est pas en `loadAll` **et** que la page
courante ne couvre pas encore `total` (`page * perPage < total`). C'est une règle de
pagination, donc elle vit **dans le manager** (§4.4) ; le contrôleur ne fait que la
relayer dans la réponse.

### 4.3 Le DTO : `CardListQuery`

Requête immuable qui **normalise** ses valeurs à la construction, pour que le manager et
le repository n'aient jamais à borner quoi que ce soit :

```php
readonly class CardListQuery
{
    public const int DEFAULT_PER_PAGE = 12;
    public const int MAX_PER_PAGE     = 60;

    public function __construct(
        string $search = '',
        int $page = 1,
        int $perPage = self::DEFAULT_PER_PAGE,
        bool $loadAll = false,
        ?int $customerId = null,
        ?string $type = null,
    ) {
        $this->search     = trim($search);
        $this->page       = max(1, $page);
        $this->perPage    = min(self::MAX_PER_PAGE, max(1, $perPage));
        $this->loadAll    = $loadAll;
        $this->customerId = (null !== $customerId && $customerId > 0) ? $customerId : null;
        $this->type       = (null !== $type && '' !== $type) ? SiteType::tryFrom($type) : null;
    }
}
```

`customerId` et `type` sont des exemples de **filtres métier** portés par le DTO (le
second normalise une chaîne d'URL en `enum SiteType`). Pour une autre liste, on ajoute
(ou remplace) les propriétés de filtre dont on a besoin ; chacune est **normalisée dans le
constructeur** pour que le manager et le repository reçoivent une valeur déjà validée.

### 4.4 Manager

Le manager **orchestre** : il résout le périmètre / les droits, appelle le repository,
enrichit chaque item (ici les stats de tags calculées par lot pour éviter une requête par
carte, et la traduction / l'icône du type de site), puis calcule `hasMore`. Il renvoie la
page `{items, total, totalAll, hasMore}`.

```php
/**
 * @param MarketingOperationState[] $statuses
 *
 * @return array{items: array<int, array<string, mixed>>, total: int, totalAll: int, hasMore: bool}
 */
public function getSitesCardPage(User $user, CardListQuery $query, array $statuses = []): array
{
    [$customerIds, $userId] = $this->resolvePerimeter($user);

    $page = $this->siteRepository->getActiveSitesStatsPage(
        $query->search, $query->page, $query->perPage,
        $customerIds, $userId, $statuses, $query->loadAll, $query->customerId, $query->type
    );

    $siteIds    = array_column($page['items'], 'id');
    $tagsBySite = $this->tagRepository->getTagsDataBySiteIds($siteIds);

    foreach ($page['items'] as $index => $item) {
        $tags = $tagsBySite[$item['id']] ?? [];
        $type = $item['type'];
        $item['type']      = $type->value;
        $item['typeIcon']  = $type->getIcon();
        $item['typeLabel'] = $this->translator->trans($type->getLabelKey());
        $page['items'][$index] = $item + $this->tagStatsCalculator->calculate($tags);
    }

    $page['hasMore'] = !$query->loadAll && $query->page * $query->perPage < $page['total'];

    return $page;
}
```

**Enrichissement par lot** : charger les données annexes (stats, entités) **indexées par
id** en une requête, puis boucler pour fusionner — jamais une requête par carte.

**Enrichissement de présentation** : un enum porté par l'item (ici `SiteType`) est
**aplati** par le manager en valeurs prêtes à afficher (`type`, `typeIcon`, `typeLabel`),
car le contrôleur JS ne sait remplir que des scalaires — voir l'icône de tête au §5.

### 4.5 Repository

On utilise le `CardListQueryTrait`. La méthode calcule `total` (recherche courante) et
`totalAll` (périmètre entier), applique périmètre / filtres / recherche / pagination,
puis renvoie `{items, total, totalAll}`.

```php
public function getActiveSitesStatsPage(
    string $search, int $page, int $perPage,
    ?array $customerIds, ?int $userId,
    array $statuses = [], bool $loadAll = false, ?int $filterCustomerId = null,
    ?SiteType $filterType = null,
): array {
    if (null !== $customerIds && [] === $customerIds) {
        return ['items' => [], 'total' => 0, 'totalAll' => 0];   // périmètre vide
    }

    $total    = $this->countActiveSitesForPerimeter($search, $customerIds, $userId, $filterCustomerId, $filterType);
    $totalAll = '' === $search
        ? $total
        : $this->countActiveSitesForPerimeter('', $customerIds, $userId, $filterCustomerId, $filterType);
    if (0 === $total) {
        return ['items' => [], 'total' => 0, 'totalAll' => $totalAll];
    }

    // 1) récupérer les ids de la page (recherche + filtres + pagination)
    $idsQb = $this->getQueryBuilderOnlyActives()->select('s.id')->orderBy('s.name', 'ASC');
    $this->applySitesPerimeter($idsQb, $customerIds, $userId);
    $this->applyCustomerFilter($idsQb, $filterCustomerId);
    $this->applyTypeFilter($idsQb, $filterType);
    $this->applyCardListSearch($idsQb, $search, self::CARD_LIST_SEARCH_FIELDS);
    if (!$loadAll) {
        $this->applyCardListPagination($idsQb, $page, $perPage);
    }
    $ids = array_column($idsQb->getQuery()->getScalarResult(), 'id');
    if ([] === $ids) {
        return ['items' => [], 'total' => $total, 'totalAll' => $totalAll];
    }

    // 2) charger les stats agrégées uniquement pour ces ids
    $items = $this->buildActiveSitesStatsQb($statuses)
        ->andWhere('s.id IN (:siteIds)')->setParameter('siteIds', $ids)
        ->orderBy('s.name', 'ASC')->getQuery()->getResult();

    return ['items' => $items, 'total' => $total, 'totalAll' => $totalAll];
}
```

**Règles côté requête :**

- **Deux passes** quand on agrège (`GROUP BY`) : d'abord les **ids** de la page (tri +
  recherche + filtre + `LIMIT`/`OFFSET`), puis les **stats** sur ces ids uniquement. Cela
  évite que la pagination porte sur des lignes dupliquées par les jointures.
- **`total` vs `totalAll`** : `total` compte avec la recherche courante (borne la
  pagination et `hasMore`) ; `totalAll` compte le périmètre sans recherche (compteur
  « X sur N »). Sans recherche, ils sont égaux — on ne compte alors qu'une fois.
- **Sorties anticipées** : un périmètre restreint à une liste d'ids vide renvoie
  immédiatement une page vide, sans requête ; de même, un `total` nul ou une première
  passe ne ramenant aucun id court-circuitent la requête de stats (en conservant
  `total` / `totalAll` déjà calculés).
- **`loadAll`** : quand il est vrai, on **n'applique pas** la pagination.
- La recherche et la pagination viennent du trait — voir §5.

### 4.6 Le socle : `CardListQueryTrait`

À ne pas modifier ; il fournit les deux briques communes à toutes les listes :

```php
trait CardListQueryTrait
{
    /** @param string[] $fields DQL, ex. ['s.name'] */
    protected function applyCardListSearch(
        QueryBuilder $qb, string $search, array $fields, string $parameter = 'cardListSearch'
    ): void {
        $search = trim($search);
        if ('' === $search || [] === $fields) {
            return;
        }
        $orX = $qb->expr()->orX();
        foreach ($fields as $field) {
            $orX->add(sprintf('LOWER(%s) LIKE :%s', $field, $parameter));
        }
        $qb->andWhere($orX)->setParameter($parameter, '%'.mb_strtolower($search).'%');
    }

    protected function applyCardListPagination(QueryBuilder $qb, int $page, int $perPage): void
    {
        if ($page < 1)    { $page = 1; }
        if ($perPage < 1) { $perPage = CardListQuery::DEFAULT_PER_PAGE; }
        $qb->setFirstResult(($page - 1) * $perPage)->setMaxResults($perPage);
    }
}
```

Les champs de recherche se déclarent dans le repository concret (constante), par ex. :

```php
private const array CARD_LIST_SEARCH_FIELDS = ['s.name', "CONCAT(s.externalId, '')", 'c.name'];
```

## 5. Structure d'une carte (le prototype `<template>`)

Chaque carte est **clonée côté client** depuis le `<template>` du layout, puis remplie
à partir de l'objet `item`. Huit zones, toutes optionnelles sauf le titre :

| Zone | Élément | Source |
|---|---|---|
| **Média** (optionnel) | bloc `cl_card_media` → élément `[data-media-field]` | `item[data-media-field]` porte la **source** de l'image (URL ou URI `data:`). Le contrôleur y insère un `<img loading="lazy">` et **retire l'élément** si la source est vide. Le `data-alt-field` optionnel désigne le champ servant de texte alternatif. |
| **Icône de tête** (optionnel) | bloc `cl_card_icon` → élément `[data-icon-field]` | `item[data-icon-field]` donne le **nom** d'une icône Bootstrap (`bi-<nom>`) rendue en tête de carte. Si la valeur est vide, l'élément est retiré. Un `data-title-field` optionnel remplit l'attribut `title` depuis `item[...]`. |
| **Titre** | `.card-list__card-title` | `item[cl_title_field]` (mis en majuscule initiale). |
| **Sous-titre** (optionnel) | bloc `cl_subtitle` → `.card-list__card-subtitle` | chaque `<span data-field="key">` du bloc reçoit `item[key]`. Le sous-titre est masqué (`d-none`) tant qu'aucun champ n'a de valeur. |
| **Badge** (optionnel) | bloc `cl_card_badge` → élément `[data-badge-field]` | `item[data-badge-field]` donne le **libellé**. Le `data-badge-variant-field` optionnel désigne un second champ dont la valeur devient le modifieur `card-list__card-badge--<variante>`. Élément retiré si le libellé est vide. |
| **Corps libre** (optionnel) | bloc `cl_card_body` | zone libre entre l'en-tête et les stats, typiquement un `.card-list__card-text` contenant un `data-field` (description multi-lignes). |
| **Lignes de stats** | `<li data-row-name="…">` du bloc `cl_rows` | `item[data-row-name]`, précédé d'une icône et suivi du libellé (texte du `<li>`). |
| **Tags** (optionnel) | bloc `cl_card_tags` → élément `[data-tags-field]` | `item[data-tags-field]` est un **tableau** de chaînes ; le contrôleur ajoute un `<span class="card-list__card-tag">` par entrée. Élément retiré si la valeur n'est pas un tableau ou ne produit aucun tag. |

> **Où se remplissent les `data-field`** — tout élément portant un `data-field`, **où qu'il
> soit dans la carte**, reçoit `item[<clé>]` en texte. Le sous-titre n'en est qu'un cas
> particulier : son bloc pilote en plus le retrait du `d-none`.

> ⚠️ **Le kit ne peint rien.** Ces zones ne portent que la structure (placement, flux,
> recadrage de l'image). Couleurs, typographie, rayons et **variantes de badge** se
> déclarent dans la feuille de style du projet hôte, sur les classes `card-list__card-*`.
> Voir `dev-app/assets/styles/app.scss` pour un exemple complet.

### Définition de l'icône de tête (bloc `cl_card_icon`)

L'icône de tête est **pilotée par la donnée** : le template déclare *où* l'icône se place
et *quel champ* de l'`item` porte son nom, mais le nom lui-même vient du back (ex. une icône
calculée selon le type de site). Le contrôleur lit `item[data-icon-field]`, crée un
`<i class="bi bi-<nom>">` à l'intérieur de l'élément, et **retire tout l'élément** si le champ
est vide. Le `data-title-field` optionnel désigne un second champ de l'`item` utilisé comme
attribut `title` (info-bulle).

```twig
{% block cl_card_icon %}
    <span class="card-list__card-icon" data-icon-field="icon" data-title-field="typeLabel"></span>
{% endblock cl_card_icon %}
```

### Définition du sous-titre (bloc `cl_subtitle`)

Le sous-titre n'est plus piloté par des `{% set %}` : on **déclare son HTML** dans le bloc
`cl_subtitle`, à l'intérieur d'un élément `.card-list__card-subtitle` marqué `d-none`. Chaque
`<span data-field="key">` est rempli par le contrôleur depuis `item[key]`, ce qui permet de
composer un sous-titre riche (plusieurs champs, icônes, séparateurs). Dès qu'au moins un
`data-field` porte une valeur, le contrôleur retire le `d-none`.

```twig
{% block cl_subtitle %}
    <p class="card-list__card-subtitle d-none">
        <i class="bi bi-building" aria-hidden="true"></i> <span data-field="customerName"></span>
        &emsp;|&emsp;
        <i class="bi bi-wrench" aria-hidden="true"></i> <span data-field="externalId"></span>
    </p>
{% endblock cl_subtitle %}
```

### Définition du média, du badge et des tags

Ces trois zones suivent la même règle que les précédentes : le template déclare *où* la
donnée se place et *quel champ* la porte, le back décide de la valeur.

```twig
{% block cl_card_media %}
    <div class="card-list__card-media" data-media-field="image" data-alt-field="title"></div>
{% endblock cl_card_media %}

{% block cl_card_badge %}
    <span class="card-list__card-badge" data-badge-field="status" data-badge-variant-field="statusVariant"></span>
{% endblock cl_card_badge %}

{% block cl_card_body %}
    <p class="card-list__card-text" data-field="description"></p>
{% endblock cl_card_body %}

{% block cl_card_tags %}
    <div class="card-list__card-tags" data-tags-field="tags"></div>
{% endblock cl_card_tags %}
```

L'`item` correspondant :

```json
{
  "title": "Portfolio",
  "image": "data:image/png;base64,iVBORw0KGgo…",
  "description": "Site vitrine animé en Canvas et Web Audio.",
  "status": "Publié",
  "statusVariant": "published",
  "tags": ["HTML", "CSS", "JavaScript"]
}
```

- **`image`** accepte une URL comme une URI `data:`, ce qui permet de servir une image
  stockée en base sans route dédiée.
- **`statusVariant`** produit la classe `card-list__card-badge--published`, que le projet
  hôte style à sa guise. La valeur est nettoyée côté contrôleur (minuscules, `[a-z0-9-]`)
  pour rester un suffixe de classe valide.
- **`tags`** doit être un **tableau** : c'est le seul champ dont le contrôleur n'attend pas
  un scalaire.

### Définition des lignes de stats (`<li>` dans `cl_rows`)

Chaque ligne se décrit par un `<li>` dont le **texte** est le libellé et les `data-*`
pilotent le reste. Le contrôleur rend par défaut « `[icône] valeur libellé` ».

| Attribut du `<li>` | Effet |
|---|---|
| `data-row-name="key"` | **Clé de donnée** liant la ligne au champ de l'`item`. Obligatoire. |
| `data-row-icon="vinyl-fill"` | Icône Bootstrap Icons (`bi-<icon>`) affichée devant la valeur. Optionnel. |
| `data-row-icon-color="warning"` | Couleur de l'icône via un modifieur BEM `card-list__stat-icon--<color>` (`warning`, `danger`, `success`…). Sans attribut, l'icône reste `primary` via sa classe de base. |
| `data-row-value-position="right"` | Position de la valeur. `left` (défaut) rend « `[icône] valeur libellé` » ; `right` inverse en « `[icône] libellé : valeur` » (ajoute le modifieur `card-list__stat--value-right`). |

Exemple complet (extrait de la liste des sites) :

```twig
{% block cl_rows %}
    <li data-row-name="nbGateway"        data-row-icon="vinyl-fill"                                              >{{ 'site.card.row.gateways'|trans }}</li>
    <li data-row-name="nbTagsAvgBattery" data-row-icon="battery-half"              data-row-icon-color="warning" >{{ 'site.card.row.avg_battery'|trans }}</li>
    <li data-row-name="nbTagsError"      data-row-icon="exclamation-triangle-fill" data-row-icon-color="warning" >{{ 'site.card.row.tags_error'|trans }}</li>
    <li data-row-name="nbTagsLowBattery" data-row-icon="battery"                   data-row-icon-color="danger"  >{{ 'site.card.row.low_battery'|trans }}</li>
{% endblock cl_rows %}
```

## 6. Configuration du template (`{% set %}`)

Ces variables se déclarent en haut du template ; le layout les transforme en `data-*`
sur le conteneur `.card-list` (valeurs du contrôleur Stimulus).

| Variable | Type | Défaut | Obligatoire | Effet |
|---|---|---|---|---|
| `cl_url` | URL | — | ✅ | Route AJAX renvoyant le JSON de la liste. |
| `cl_per_row` | int | `4` | ❌ | Nombre de cartes par ligne (colonnes de la grille, plafonné aux breakpoints responsive). |
| `cl_rows` | int | `3` | ❌ | Nombre de lignes affichées par défaut, et rechargées à chaque « charger plus ». `perPage = cl_per_row * cl_rows`. |
| `cl_title_field` | string | `'name'` | ❌ | Champ de l'`item` servant de titre. |
| `cl_card_clickable` | bool | `false` | ❌ | Enveloppe la carte dans un `<a href="item.url">` et ajoute un chevron. |
| `cl_active_search` | bool | `true` | ❌ | Affiche la barre de recherche. |
| `cl_show_number` | bool | `false` | ❌ | Affiche le compteur « X sur N ». |
| `cl_load_all` | bool | `false` | ❌ | Affiche le bouton « tout charger » en plus de « charger plus ». |
| `cl_active_filter` | bool | `false` | ❌ | Affiche le bouton / panneau de filtres (offcanvas). |
| `cl_url_search_param` | string | `''` | ❌ | Nom d'un paramètre d'URL pré-remplissant la recherche au chargement (deep-link). |
| `cl_search_placeholder` | string | `search.placeholder` (cardList) | ❌ | Placeholder du champ de recherche. |
| `cl_filter_title` | string | `filter.title` (cardList) | ❌ | Titre du panneau de filtres. |
| `cl_loading_label` | string | `loading` (cardList) | ❌ | Texte alternatif des illustrations de chargement (overlay + pied de « charger plus »). |
| `cl_count_key` | string | `'count'` | ❌ | Clé de traduction du compteur « X sur N ». Nécessite `cl_show_number`. |
| `cl_count_domain` | string | `'cardList'` | ❌ | Domaine de la clé ci-dessus : le passer à `messages` (ou un autre domaine métier) pour un libellé propre à la liste. |

> ⚠️ **`cl_rows` porte deux sens** : la variable `{% set cl_rows = 1 %}` est le **nombre de
> lignes de cartes** chargées par page, tandis que le bloc `{% block cl_rows %}` déclare les
> **lignes de stats** d'une carte (§5). Les deux cohabitent dans le même template sans
> conflit, mais ne les confondez pas.

## 7. Blocs Twig disponibles

| Bloc | Rôle |
|---|---|
| `cl_card_media` | **Image** en tête de carte (un `[data-media-field]`, cf. §5). |
| `cl_card_icon` | **Icône de tête** du prototype de carte (un `[data-icon-field]`, cf. §5). |
| `cl_rows` | **Lignes de stats** du prototype de carte (les `<li data-row-name>`). |
| `cl_subtitle` | **Sous-titre** du prototype de carte (un `.card-list__card-subtitle d-none` avec des `<span data-field>`). |
| `cl_card_badge` | **Badge** de l'en-tête (un `[data-badge-field]`, cf. §5). |
| `cl_card_body` | **Corps libre** entre l'en-tête et les stats (description, encart…). |
| `cl_card_tags` | **Tags** en pied de carte (un `[data-tags-field]` alimenté par un tableau). |
| `cl_filters` | Contenu du panneau de filtres (offcanvas). Nécessite `cl_active_filter = true`. |
| `cl_toolbar_actions` | Actions libres ajoutées à droite de la toolbar (ex. « Créer »). |
| `cl_grid_class` | Classes CSS additionnelles sur la grille `.card-list__grid`. |

## 8. Recherche

La barre de recherche (`cl_active_search`, activée par défaut) envoie le terme au serveur
en **debounce de 300 ms** : chaque frappe réarme le minuteur, et à l'expiration la liste
repart de la page 1 et remplace la grille. Côté back, la recherche est un `LIKE` insensible
à la casse OR-combiné sur les `CARD_LIST_SEARCH_FIELDS` du repository (§4.6).

**Deep-link** : `cl_url_search_param` permet de pré-remplir la recherche depuis l'URL.
Avec `{% set cl_url_search_param = 'q' %}`, arriver sur `?q=paris` remplit la barre et
filtre au chargement.

## 9. Filtres

Un filtre se déclare dans le bloc `cl_filters` (rendu dans le panneau offcanvas). Chaque
champ porte la cible Stimulus `filterField` et un `data-filter-param` (= la clé envoyée
au serveur) :

```twig
{% block cl_filters %}
    <div class="data-table-filter__field">
        <label class="data-table-filter__label" for="cl-filter-customer">
            {{ 'filter.customer'|trans({}, 'cardList') }}
        </label>
        <select
            id="cl-filter-customer"
            class="form-select"
            data-filter-param="customer"
            {{ stimulus_target('generic--card-list', 'filterField') }}
        >
            <option value="">{{ 'filter.customer_all'|trans({}, 'cardList') }}</option>
            {% for customer in customers %}
                <option value="{{ customer.id }}">{{ customer.name }}</option>
            {% endfor %}
        </select>
    </div>
{% endblock cl_filters %}
```

Le bouton « Appliquer » (fourni par le layout) déclenche `filter()` : le contrôleur
collecte chaque `filterField` en une map `{ data-filter-param: valeur }`, **ignore les
valeurs vides** (l'option « tous » porte une valeur vide), puis recharge depuis la page 1.
Côté back, ces paramètres arrivent en query string ; on les mappe sur des propriétés du
`CardListQuery` (ex. `customerId`) et on applique le `WHERE` correspondant dans le repository.

Un `<select>` de filtre peut être enrichi (recherche interne) en lui ajoutant
`{{ stimulus_controller('symfony/ux-autocomplete/autocomplete') }}` en plus de la cible
`filterField`, comme le filtre client de la liste des sites.

### Filtre à choix multiple

Ajouter `multiple` au `<select>` : le contrôleur lit alors **toutes** les options
sélectionnées (`selectedOptions`), ignore les valeurs vides et omet le filtre si aucune ne
reste. Les valeurs partent en paramètres répétés avec la notation PHP `param[]`
(`tag[]=a&tag[]=b`), jamais jointes par des virgules (une valeur peut en contenir une).
Compatible avec `ux-autocomplete` : Tom Select tient à jour les options sélectionnées du
`<select>` d'origine.

```twig
<div class="data-table-filter__field">
    <label class="data-table-filter__label" for="cl-filter-tag">
        {{ 'filter.tag'|trans({}, 'cardList') }}
    </label>
    <select
        id="cl-filter-tag"
        class="form-select"
        multiple
        data-filter-param="tag"
        {{ stimulus_controller('symfony/ux-autocomplete/autocomplete') }}
        {{ stimulus_target('generic--card-list', 'filterField') }}
    >
        {% for tag in tags %}
            <option value="{{ tag.slug }}">{{ tag.name }}</option>
        {% endfor %}
    </select>
</div>
```

Côté contrôleur PHP, le paramètre se mappe en `array` (absent = tableau vide) :

```php
#[MapQueryParameter] array $tag = [],
// ...
$query = new SiteCardListQuery($search, $page, $perPage, $loadAll, $tag);
```

et se normalise dans le constructeur du `CardListQuery` étendu (liste de chaînes non
vides, dédoublonnées), pour que le repository n'ait qu'un `IN (:tags)` à appliquer :

```php
readonly class SiteCardListQuery extends CardListQuery
{
    /** @var list<string> */
    public array $tags;

    public function __construct(
        string $search = '',
        int $page = 1,
        int $perPage = self::DEFAULT_PER_PAGE,
        bool $loadAll = false,
        array $tags = [],
    ) {
        parent::__construct($search, $page, $perPage, $loadAll);

        $normalized = [];
        foreach ($tags as $tag) {
            // A nested array (`tag[0][]=x`) is not a string: drop it.
            if (\is_string($tag) && '' !== trim($tag)) {
                $normalized[trim($tag)] = true;
            }
        }
        // array_keys() turns numeric-string keys back into ints.
        $this->tags = array_map('strval', array_keys($normalized));
    }
}
```

L'exemple `examples/` (filtre catégorie de `cards.html.twig`, `ArticleCardListQuery`) suit ce
schéma avec des identifiants entiers.

N'afficher le filtre que quand il a du sens, par ex. `{% set cl_active_filter = customers|length > 1 %}`.

## 10. Pagination « charger plus » / « tout charger »

CardList ne pagine pas par numéros de page mais par **accumulation** :

- **« Charger plus »** (`loadMore`) : incrémente la page et **ajoute** la page suivante à
  la grille existante. Visible tant que `hasMore` est vrai.
- **« Tout charger »** (`loadAll`, opt-in via `cl_load_all`) : envoie `loadAll=1`, le
  serveur abandonne la pagination et renvoie tout le périmètre en une réponse, qui
  **remplace** la grille.

Une nouvelle recherche ou un nouveau filtre réinitialise toujours à la page 1 et remplace
la grille.

## 11. Compteur « X sur N »

Avec `cl_show_number`, un compteur `aria-live="polite"` affiche « X sur N » à côté de la
recherche : **X** est le nombre de cartes actuellement dans la grille (il grandit avec
« charger plus »), **N** est `totalAll` (le périmètre entier, indépendant de la recherche).
Le libellé vient de la clé `count` du domaine `cardList` (pluralisation ICU).

## 12. Comportement cliquable

Avec `cl_card_clickable`, chaque carte dont l'`item` porte une clé `url` est enveloppée
dans un `<a href="…">` et reçoit un chevron. L'`url` est générée côté contrôleur PHP
(routeur + droits), jamais côté JS — voir §4.2.

## 13. États : vide et chargement

Le layout fournit quatre éléments pilotés par le contrôleur :

- **`empty`** : message « aucun résultat » affiché quand la grille est vide après réponse
  (clé `empty` du domaine `cardList`).
- **`placeholder`** : overlay d'illustration (`cards-coming-soon.svg`) affiché **par-dessus**
  la grille pendant un **rechargement complet** (chargement initial, recherche, filtre,
  « tout charger »). Le contrôleur retire `card-list__placeholder--hidden` pendant la
  requête puis remet le modifieur au retour — la grille (opacité 0 → 1) et l'overlay se
  **fondent l'un dans l'autre**. Le layout pose `card-list__frame--loading` au rendu Twig
  (masque la grille sous l'overlay) ; le contrôleur le retire à la fin de la première
  requête, une fois les cartes dessinées.
- **`loader`** (`more-loader`) : la **même** illustration affichée **sous** les cartes
  existantes pendant un « charger plus » (la grille reste visible, on ajoute la page
  suivante en dessous). Masqué en dehors des requêtes.
- Les boutons « charger plus » / « tout charger » sont désactivés pendant le chargement
  et masqués quand `hasMore` est faux.

L'illustration et son `alt` viennent du socle : le SVG
`public/images/loading/cards-coming-soon.svg` et la clé `loading` du domaine `cardList`.

Les erreurs de requête sont capturées et envoyées à **Sentry** (`Sentry.captureException`),
jamais silencieusement avalées.

## 14. Internationalisation

Deux domaines cohabitent, chacun avec sa responsabilité :

- **Domaine `cardList`** (`translations/cardList+intl-icu.fr.yaml`) — les libellés de
  l'**UI générique** du module : `search.placeholder`, `loadMore`, `loadAll`, `empty`,
  `count`, `filter.*`. Ce fichier fait partie du socle à copier.
- **Domaine `messages`** (ou autre domaine métier) — les libellés **propres à la liste** :
  titres de lignes de stats (`site.card.row.*`), etc.

On accède au domaine `cardList` en le précisant explicitement :

- côté JS : `translate('count', { displayed, total }, 'cardList')` ;
- côté Twig : `{{ 'filter.label'|trans({}, 'cardList') }}`.

Les libellés métier des lignes de stats se traduisent dans leur domaine, dans le bloc
`cl_rows` : `{{ 'site.card.row.gateways'|trans }}`.

## 15. Checklist « nouvelle liste »

1. **Template** : étendre `cardList/layout.html.twig`, poser `cl_url`, le titre
   (`cl_title_field`), le bloc `cl_rows` avec un `<li data-row-name="…">` par stat, et si
   besoin le bloc `cl_subtitle` (`.card-list__card-subtitle d-none` + `<span data-field>`).
2. **Route** : ajouter une action GET `#[MapQueryParameter]` (protégée par un Voter si
   besoin) qui construit un `CardListQuery`, le transmet au manager, ajoute les `url` des
   items si la liste est cliquable, et renvoie `{items, hasMore, total, totalAll, page}`
   — `hasMore` étant simplement relayé depuis la page renvoyée par le manager.
3. **Manager** : résoudre périmètre / droits, appeler le repository, enrichir les items
   par lot (jamais une requête par carte), calculer `hasMore`, renvoyer
   `{items, total, totalAll, hasMore}`.
4. **Repository** : utiliser `CardListQueryTrait`, déclarer `CARD_LIST_SEARCH_FIELDS`,
   écrire `getXxxCardPage()` avec le calcul de `total` / `totalAll`, la sortie anticipée
   périmètre vide, la recherche / le filtre / la pagination, puis (si agrégation) la
   double passe ids → stats.
5. **Filtres** *(si besoin)* : bloc `cl_filters` avec des `filterField` + `data-filter-param`,
   propriété correspondante sur le `CardListQuery`, `WHERE` dans le repository.
6. **Traductions** : réutiliser le domaine `cardList` pour l'UI ; ajouter les libellés de
   lignes / sous-titre dans le domaine métier.
