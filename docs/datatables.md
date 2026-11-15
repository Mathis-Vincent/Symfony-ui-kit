# Module DataTables

Ce guide décrit un module DataTables **server-side** complet et portable : un socle
que l'on copie une seule fois, puis un plan de câblage à répéter pour chaque nouvelle
table. L'objectif est d'obtenir une table paginée / triée / filtrée **opérationnelle
avec le minimum de code par page**.

## 1. Architecture en 5 couches

Une table repose sur cinq couches, chacune avec une responsabilité unique :

| Couche | Fichier de référence | Rôle |
|---|---|---|
| **Template Twig** | `@MVincentUiKit/dataTable/layout.html.twig` | Déclare la table, ses colonnes et sa configuration via des `{% set %}` / blocs. C'est ce template qu'une page **étend**. |
| **Contrôleur Stimulus** | `assets/controllers/generic/datatables_controller.js` | Lit la config depuis les `data-*`, instancie DataTables en mode serveur, gère filtres / mobile / multi-sélection. |
| **Contrôleur PHP** | ex. `Controller/CustomerController.php` | Route GET qui reçoit les paramètres DataTables, les transmet au manager, puis construit la `JsonResponse`. Aucune logique métier (hors vérification de droits). |
| **Manager PHP** | ex. `Manager/CustomerManager.php` | Orchestre la fonctionnalité : applique le périmètre / les droits, appelle le repository puis le formatter, et renvoie la réponse DataTables prête. C'est ici que vit la logique. |
| **Repository PHP** | `Repository/DatatableRepository.php` (socle) + repo concret | Construit la requête (SELECT / filtres / pagination) et assemble la réponse DataTables. |

Le flux : le template **déclare** la config → le layout la **traduit** en attributs HTML →
le contrôleur JS la **consomme** et appelle en AJAX la route PHP → le contrôleur **transmet**
au manager → le manager **orchestre** (repository + formatter) → le repository **répond**
en JSON → un formatter **habille** chaque cellule en HTML.

## 2. Contenu du module

### Socle réutilisable (fourni par le bundle, rien à copier)

Ces fichiers sont **génériques** : ils vivent dans le bundle `mathis-vincent/symfony-ui-kit`,
ne connaissent aucune entité et se partagent
d'un projet à l'autre sans modification.

- `@MVincentUiKit/dataTable/layout.html.twig` — le layout de table étendable.
- `@MVincentUiKit/partials/card/_card.html.twig` — la carte dont hérite le layout.
- `assets/controllers/generic/datatables_controller.js` — le contrôleur Stimulus.
- `src/Repository/DatatableRepository.php` — la classe abstraite (tri sécurisé +
  pagination + assemblage de la réponse).
- `@MVincentUiKit/dataTable/generic/checkbox.html.twig` — case à cocher de ligne.
- `@MVincentUiKit/dataTable/generic/text.html.twig` — cellule texte (`text`, `class`, `title`).
- `@MVincentUiKit/dataTable/generic/link.html.twig` — cellule lien (`url`, `text`, `class`, `title`).
- Les styles `assets/styles/modules/datatable/*.scss` et le partial
  `assets/styles/modules/_datatable-loader.scss` (overlay d'illustration + fondu, cf. §13).
- L'illustration de chargement `public/images/loading/table-coming-soon.svg`, affichée
  en overlay pendant chaque requête serveur (cf. §13).
- Les clés de traduction sous le préfixe `datatable.*` (`translations/dataTable+intl-icu.fr.yaml`).

### Prérequis (dépendances front)

Le contrôleur Stimulus s'appuie sur :

```js
import DataTable from 'datatables.net-bs5';
import 'datatables.net-select-bs5';
```

Il attend aussi une variable Twig globale `dt_controller_name` exposant le nom du
contrôleur Stimulus (`generic--datatables`), et un translator Stimulus exposant
`translate(key)`.

### À créer pour chaque table

1. Un **template** qui étend `dataTable/layout.html.twig` (colonnes + config).
2. Une **route GET** dans un contrôleur qui transmet les paramètres au manager.
3. Une **méthode de manager** qui orchestre droits / repository / formatter.
4. Une **méthode de repository** `getXxxDataForDatatable(...)` héritant de `DatatableRepository`.
5. *(optionnel)* un **formatter** pour transformer les valeurs brutes en HTML.

## 3. Le contrat front ↔ back

C'est le cœur du module : front et back se parlent avec les **noms de colonnes**
(`data-column-name` côté HTML = alias SQL côté SELECT = clé JSON de la réponse).

**Requête** (paramètres GET natifs DataTables) :

| Paramètre | Type | Contenu |
|---|---|---|
| `draw` | int | Compteur de requête, à renvoyer tel quel. |
| `start` | int | Offset de la première ligne (pagination). |
| `length` | int | Nombre de lignes par page. |
| `order` | array | `[{column: <index>, dir: 'asc'\|'desc'}]`. |
| `columns` | array | `[{data: '<nom_colonne>'}, ...]` dans l'ordre d'affichage. |
| `search` | array | `{value: '<terme>'}` — recherche globale. |

**Réponse** (JSON) :

```json
{
  "draw": 3,
  "recordsTotal": 10,
  "recordsFiltered": 42,
  "data": [ { "name": "...", "created_at": "...", "actions": "<a ...>" } ]
}
```

Chaque objet de `data` a pour clés les `data-column-name` des colonnes. Les valeurs
sont soit des scalaires, soit du HTML déjà rendu (voir formatter).

## 4. Exemple minimal complet

### 4.1 Template (`templates/pages/xxx/list.html.twig`)

```twig
{% extends "@MVincentUiKit/dataTable/layout.html.twig" %}

{% set dt_url_populate = url('app_users_list_datatable') %}

{% block dt_thead_tr %}
    <th data-column-name="username">{{ 'user.list.th.username'|trans }}</th>
    <th data-column-name="name">{{ 'user.list.th.name'|trans }}</th>
    <th data-column-name="created_at">{{ 'user.list.th.created_at'|trans }}</th>
{% endblock %}
```

Seul `dt_url_populate` est réellement obligatoire : sans lui, le contrôleur
n'initialise pas la table.

### 4.2 Route (contrôleur PHP)

Le contrôleur ne fait que **transporter** : il reçoit les paramètres via
`#[MapQueryParameter]`, les transmet au manager, puis construit la `JsonResponse`.
Aucune manipulation de données ici (hors vérification de droits).

```php
#[Route('/users-datatable', name: 'app_users_list_datatable', methods: ['GET'])]
#[IsGranted(UserVoter::LIST)]
public function usersListDataDatatableJson(
    UserManager $userManager,
    #[MapQueryParameter] int   $start   = 0,
    #[MapQueryParameter] int   $length  = 0,
    #[MapQueryParameter] int   $draw    = 0,
    #[MapQueryParameter] array $order   = [],
    #[MapQueryParameter] array $columns = [],
    #[MapQueryParameter] array $search  = [],
): JsonResponse {
    $result = $userManager->getDataForDatatable($start, $length, $draw, $order, $columns, $search);

    return new JsonResponse($result);
}
```

### 4.3 Manager

Le manager **orchestre** : il applique le périmètre / les droits métier, appelle le
repository, puis passe les lignes au formatter. Il renvoie la réponse DataTables prête
à sérialiser.

```php
class UserManager
{
    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly UserDataTableFormatter $formatter,
    ) {
    }

    /**
     * @param array<int, array{column: int, dir: string}> $order
     * @param array<int, array{data: string}>             $columns
     * @param array{value?: string}                       $search
     *
     * @return array{draw: int, recordsTotal: int, recordsFiltered: int, data: array<int, array<string, mixed>>}
     */
    public function getDataForDatatable(
        int $start,
        int $length,
        int $draw,
        array $order,
        array $columns,
        array $search,
    ): array {
        $result = $this->userRepository->getDataForDatatable($length, $start, $order, $draw, $columns, $search);
        $result['data'] = $this->formatter->formatRows($result['data']);

        return $result;
    }
}
```

### 4.4 Repository

On hérite de `DatatableRepository`. La méthode construit le `QueryBuilder`
(un `AS <alias>` par colonne, filtres, `search`, `LIMIT`/`OFFSET`) puis **délègue
systématiquement** à `formatResults()`.

```php
class UserRepository extends DatatableRepository
{
    public function getDataForDatatable(
        int $limit,
        int $start,
        array $orders,
        int $draw,
        array $columns,
        array $search = [],
    ): array {
        $qb = $this->createQueryBuilder('u')
            ->select('u.username AS username')          // alias == data-column-name
            ->addSelect('u.name AS name')
            ->addSelect('u.createdAt AS created_at')
            ->addSelect('u.id AS uid');                 // alias technique (liens / droits)

        // Recherche globale
        if (!empty($search['value'])) {
            $qb->andWhere($qb->expr()->like('LOWER(u.username)', 'LOWER(:search)'))
               ->setParameter('search', '%'.trim($search['value']).'%');
        }

        $qb->setMaxResults($limit)      // length
           ->setFirstResult($start);    // start

        return $this->formatResults($qb, $orders, $columns, $draw);
    }
}
```

**Règles côté requête :**

- **Un alias par colonne** : `... AS username` doit correspondre exactement au
  `data-column-name="username"` du `<th>` et à la clé JSON attendue.
- **`start` → `setFirstResult`**, **`length` → `setMaxResults`**.
- **`search['value']`** = recherche globale ; on l'applique manuellement en
  `LIKE LOWER(...)` sur les colonnes voulues.
- Prévoir un **alias technique** (ex. `uid`) pour construire URLs et vérifs de droits
  dans le formatter, sans l'afficher (colonne masquée ou champ non colonne).
- Le **tri** est géré par `formatResults()` : il n'accepte que `ASC`/`DESC` et vérifie
  que la colonne demandée est bien un alias présent dans le SELECT (protection
  anti-injection). Rien à faire de plus.

### 4.5 Le socle : `DatatableRepository`

À ne pas modifier ; il assemble la réponse pour toutes les tables :

```php
abstract class DatatableRepository extends ServiceEntityRepository
{
    public function formatResults(QueryBuilder $qb, array $orders, array $columns, int $draw): array
    {
        $columnsOrdered = array_map(fn (array $c): string => $c['data'], $columns);

        foreach ($this->getOrderingParts($columnsOrdered, $orders, $qb) as $order) {
            $qb->addOrderBy($order['column'], $order['order']);
        }

        $paginator = new Paginator($qb);
        $data = $paginator->getQuery()->getResult();

        $orderedData = [];
        foreach ($data as $datum) {
            // réordonne les clés selon l'ordre des colonnes DataTables
            $orderedData[] = array_merge(array_flip($columnsOrdered), $datum);
        }

        return [
            'draw' => $draw,
            'recordsTotal' => count($orderedData),
            'recordsFiltered' => count($paginator),
            'data' => $orderedData,
        ];
    }
    // getOrderingParts() / searchColumnInQb() : tri sécurisé par alias
}
```

## 5. Habillage des cellules (formatter)

Le repository renvoie des valeurs **brutes**. Pour rendre du HTML (liens, badges,
actions) et appliquer l'autorisation par ligne, le manager post-traite `data` avant
de renvoyer la réponse.

Deux approches :

- **Formatter dédié** (recommandé dès qu'il y a de la logique / des droits) : un service
  `src/Service/Format/XxxDataTableFormatter`, exposant
  `formatRows(array $rows): array` et appelé par le manager.
- **`renderView` en ligne** dans le manager pour les cas triviaux.

### Le socle : `AbstractDataTableRowFormatter`

Dès que l'habillage d'une ligne dépend des **droits sur l'entité de la ligne**, on étend
`src/Service/Format/AbstractDataTableRowFormatter` plutôt que de réécrire la boucle : il
implémente `formatRows()`, charge les entités cibles **par lot** (une requête, indexées par
id) et délègue chaque ligne au formatter concret. Trois méthodes à implémenter :

| Méthode | Rôle |
|---|---|
| `getIdKey(): string` | Clé de la ligne portant l'id de l'entité cible (l'alias technique du SELECT, ex. `cid`, `sid`, `user_id`). |
| `loadTargets(array $rows): array` | Charge les entités listées **indexées par id** (`array<int, object>`), pour évaluer les droits sans requête par ligne. |
| `formatRow(array $row, ?object $target): array` | Habille les cellules de la ligne, en s'appuyant sur `$target` (`null` si l'entité n'existe plus) pour l'autorisation. |

Un formatter sans droits par ligne (ex. `TemplateDataTableFormatter`,
`NotificationDataTableFormatter`) peut se contenter d'exposer directement
`formatRows()` sans étendre l'abstraite.

Exemple de `formatRow()`, s'appuyant sur les partials génériques :

```php
private function formatRow(array $row, bool $canShow): array
{
    $detailUrl = $canShow
        ? $this->urlGenerator->generate('app_user_detail', ['id' => $row['uid']])
        : null;

    $row['actions']  = $this->twig->render('dataTable/user/actions.html.twig', ['detailUrl' => $detailUrl]);
    $row['username'] = $this->twig->render('dataTable/generic/text.html.twig', ['text' => $row['username']]);

    $dateFormat = $this->translator->trans('date.iso.8601', domain: 'format');
    if (!empty($row['created_at'])) {
        $row['created_at'] = $row['created_at']->format($dateFormat);
    }

    return $row;
}
```

Charger les entités par lot (indexées par id) pour évaluer les droits sans requête
par ligne, puis boucler sur `formatRows()`.

**Partials génériques disponibles** (dossier `dataTable/generic/`) :

| Partial | Variables | Usage |
|---|---|---|
| `text.html.twig` | `text`, `class?`, `title?` | Cellule texte simple. |
| `link.html.twig` | `url`, `text`, `class?`, `title?` | Cellule lien. |
| `checkbox.html.twig` | `value?` | Case de sélection de ligne (multi-sélection). |

## 6. Configuration du template (`{% set %}`)

Ces variables se déclarent en haut du template ; le layout les transforme en `data-*`
sur la balise `<table>`.

| Variable | Type | Défaut | Obligatoire | Dépendance | Effet |
|---|---|---|---|---|---|
| `dt_url_populate` | URL | — | ✅ | — | URL AJAX renvoyant le JSON de la table. |
| `dt_page_length` | int | `10` | ❌ | — | Lignes par page par défaut. |
| `dt_active_search` | bool | `false` | ❌ | — | Affiche la barre de recherche native. |
| `dt_active_length_menu` | bool | `false` | ❌ | — | Affiche le sélecteur « lignes par page ». |
| `dt_active_first_last` | bool | `false` | ❌ | — | Flèches « première / dernière page ». |
| `dt_active_total_info` | bool | `true` | ❌ | — | Ligne « X à Y sur Z » (passer `false` pour masquer). |
| `dt_sticky_header` | bool | `false` | ❌ | — | Épingle l'en-tête de colonnes au défilement (une fois passé sous le header d'app) et fait apparaître une ombre de navigation. Cf. §13. |
| `dt_default_orderable` | array | aucun tri | ❌ | noms de colonnes existants | Tri initial par nom : `['col', 'asc']` ou `[['c1','asc'],['c2','desc']]`. |
| `dt_url_search` | bool | `false` | ❌ | `dt_active_search = true` pour l'afficher | Recherche initiale depuis l'URL (§9). |
| `dt_url_search_param` | string | `searchFieldDt` | ❌ | `dt_url_search = true` | Nom du paramètre d'URL écouté. |
| `dt_target` | array | — | ❌ | contrôleur `[0]` présent sur un parent | Enregistre la table comme cible Stimulus `['controller', 'nom']`. |

Le menu de longueur propose `[10, 25, 50, 100]`. Une valeur de `dt_page_length` hors de
cette liste y est insérée et la liste est triée.

Pour un attribut HTML brut réellement non couvert par ces variables (rare), utiliser
le bloc `dt_table_attr` — sinon privilégier les `{% set %}` :

```twig
{% block dt_table_attr %}data-mon-attribut-custom="valeur"{% endblock %}
```

## 7. Blocs Twig disponibles

Hérités du partial card et du layout :

| Bloc | Rôle |
|---|---|
| `card_title` | Titre de la table (déplacé dans l'en-tête au rendu). |
| `card_header` | En-tête personnalisé complet (prioritaire sur `card_title`). |
| `card_filters` | Zone des filtres (offcanvas / dropdown). |
| `card_actions` | Boutons d'action libres (ex. « Créer »). |
| `dt_thead_tr` | **Contenu du `<thead>`** : les `<th>` définissant les colonnes. |
| `dt_tbody_td` | Contenu statique du `<tbody>` (rare en mode serveur). |
| `dt_table_class` | Classes CSS additionnelles sur la `<table>`. |
| `dt_table_attr` | Attributs HTML bruts (voir §6). |

Si `card_filters`, `card_actions` et `card_title` sont tous vides, l'en-tête de la
carte est retiré automatiquement.

## 8. Définition des colonnes (`<th>`)

Chaque colonne se décrit par un `<th>` dans `dt_thead_tr`. Le `data-column-name` doit
correspondre à l'alias SQL / clé JSON (§3).

| Attribut du `<th>` | Effet |
|---|---|
| `data-column-name="key"` | **Clé de données** liant la colonne au champ JSON. Obligatoire (sauf colonne de sélection). |
| `data-select-name` | Colonne de cases à cocher (multi-sélection) au lieu d'une donnée. |
| `data-orderable="false"` | Verrouille le tri (ex. « actions », « roles »). |
| `class="d-none"` | Colonne masquée, mais toujours utilisable comme filtre. |
| `data-column-class="…"` | Classe(s) propagée(s) à **toutes les cellules** de la colonne (ex. `data-table__cell--select`, `data-table__cell--actions`). Le `class` du `<th>` n'habille que l'en-tête : pour styler la colonne entière, c'est cet attribut. |
| `data-default-orderable="asc\|desc"` | Tri initial déclaré **par colonne**. Utilisé uniquement si la table ne porte pas de `dt_default_orderable` (qui est prioritaire et gère le multi-colonnes). Une valeur autre que `desc` vaut `asc`. |
| `data-mobile-hide` | Colonne masquée en vue mobile « accordéon ». |
| `data-mobile-title` | Cellule résumé (toujours visible) en mobile. À défaut, la première colonne visible et libellée est promue. |

### Colonnes de filtre cachées

Un filtre côté serveur se déclare via une colonne cachée dédiée :

```twig
<th class="d-none" data-column-name="filter_role"></th>
```

Elle n'affiche rien mais permet au contrôleur de router la valeur du filtre vers la
bonne colonne (voir §9). Côté repository, on lit alors cette colonne dans les
paramètres `columns` / `search` par colonne pour appliquer le `WHERE` correspondant.

## 9. Filtres

Un champ de filtre porte `data-filter-column-name` (= le `data-column-name` de la
colonne cible), la cible Stimulus `filterField`, et déclenche l'action `filter` :

```twig
<select
    class="form-select"
    data-filter-column-name="filter_role"
    {{ stimulus_target(dt_controller_name, 'filterField') }}
>
    <option value="0">{{ 'user.filter.all'|trans }}</option>
    {% for role in roles %}
        <option value="{{ role.value }}">{{ ('user.roles.' ~ role.value)|trans }}</option>
    {% endfor %}
</select>

<button type="button" {{ stimulus_action(dt_controller_name, 'filter') }}>
    {{ 'form.apply'|trans }}
</button>
```

À la validation, `filter()` applique la recherche sur chaque colonne ciblée puis
redessine la table (les valeurs partent côté serveur dans `columns`).

### Filtre pré-appliqué au chargement

Un filtre peut arriver **déjà positionné** : il suffit que le `<select>` soit rendu avec son
`option` sélectionnée côté serveur (ex. on arrive sur la liste depuis une tuile de stats
portant un paramètre d'URL). Au `connect()`, le contrôleur lit chaque `filterField`,
résout sa colonne et alimente l'option DataTables `searchCols` : la **première** requête AJAX
part donc déjà filtrée, sans redraw supplémentaire.

Deux conséquences à connaître :

- les valeurs **vides** et la valeur **`'0'`** sont traitées comme « aucun filtre » — c'est
  pourquoi l'option « tous » porte `value="0"` (ou une valeur vide) ;
- les `filterField` sont résolues **dans le périmètre du contrôleur** : deux tables sur la
  même route ne lisent jamais les filtres l'une de l'autre.

## 10. Recherche via l'URL

Une table peut être pré-remplie avec une recherche passée dans l'URL (arriver sur une
liste déjà filtrée depuis un lien). **Opt-in** :

```twig
{% set dt_active_search = true %}   {# pour que la barre affiche la valeur #}
{% set dt_url_search = true %}
```

Par défaut, la table écoute `searchFieldDt` : `?searchFieldDt=ma+recherche` remplit la
barre et filtre au chargement. Quand **plusieurs tables** cohabitent sur une route,
donner à chacune un paramètre distinct :

```twig
{% set dt_url_search = true %}
{% set dt_url_search_param = 'searchUsers' %}
```

Un lien `?searchUsers=jean` ne pré-remplit que cette table.

## 11. Multi-sélection et actions groupées

Pour des actions de masse, quatre pièces à câbler :

| Pièce | Où | Rôle |
|---|---|---|
| Case « tout cocher » | dans le `<th>` de la colonne de sélection, avec l'action `multiSelect` | Coche / décoche toutes les cases de ligne de la page. |
| Cases de ligne | partial `dataTable/generic/checkbox.html.twig`, rendu par le formatter | Fournit la cible `multiSelectRow` **et** l'action `singleSelect`. Un `value` optionnel porte l'id de la ligne. |
| `multiActionContainer` | zone d'actions (souvent `card_actions`) | Barre d'actions groupées, masquée (`d-none`) tant qu'aucune ligne n'est cochée. |
| `multiActionSelectCount` | **à l'intérieur** du conteneur | Reçoit le nombre de lignes cochées. |

```twig
{# En-tête de la colonne de sélection #}
<th data-column-name="id" class="data-table__cell--select" data-column-class="data-table__cell--select" data-orderable="false">
    <input type="checkbox" class="form-check-input" {{ stimulus_action(dt_controller_name, 'multiSelect') }}/>
</th>

{# Barre d'actions groupées #}
<div class="dt-multi-action d-none" {{ stimulus_target(dt_controller_name, 'multiActionContainer') }}>
    <span {{ stimulus_target(dt_controller_name, 'multiActionSelectCount') }}></span>
    {{ 'selected'|trans({}, 'dataTable') }}
</div>
```

Le conteneur s'affiche dès qu'au moins une ligne est cochée.

> ⚠️ `multiActionSelectCount` est **obligatoire** dès que `multiActionContainer` existe : le
> contrôleur écrit le compteur sans vérifier la présence de la cible. Un conteneur seul lève
> une erreur Stimulus au premier clic.

Le contrôleur expose aussi `data-select-name` sur un `<th>` (colonne de cases rendue par
DataTables lui-même, sans `data-column-name`). Aucune table du projet ne l'utilise
aujourd'hui : le motif retenu est la colonne nommée + le partial `checkbox.html.twig`,
qui laisse le formatter décider ligne par ligne si la case est rendue (droits).

## 12. Piloter la table depuis l'extérieur (événements DOM)

La table n'est pas pilotée par des appels directs au contrôleur : elle **écoute** et **émet**
des événements DOM sur l'élément `<table>`, ce qui permet à n'importe quel autre contrôleur
Stimulus (formulaire de création, action de ligne, modale) de la rafraîchir sans la connaître.

| Événement | Sens | Effet / usage |
|---|---|---|
| `dt.refresh` | **écouté** | Recharge les données (`ajax.reload()`) puis émet `dt.draw`. C'est le seul moyen propre de rafraîchir une table après une création / suppression. |
| `dt.draw` | émis | Signale un redraw (après `dt.refresh` ou après `filter()`). À écouter pour re-câbler ce qui dépend des lignes. |
| `dt.multi-select` | émis | Signale un changement de sélection ; `event.detail.elements` contient les cases de ligne (`multiSelectRow`). |

Pour cibler la table, on l'enregistre comme cible du contrôleur appelant via `dt_target`
(§6) — ou on la récupère par sélecteur — puis :

```js
// Après un enregistrement réussi, rafraîchir la liste
this.tableTarget.dispatchEvent(new CustomEvent('dt.refresh'));
```

## 13. État de chargement et en-tête collant

**Overlay d'illustration.** Chaque requête serveur (chargement initial, recherche, tri,
filtre, pagination) est signalée par une illustration qui **remplace toute animation de
chargement native DataTables**. Le contrôleur écoute l'événement `processing.dt` : quand il
passe à `true` il révèle l'overlay (`#showLoader`), quand il repasse à `false` il le fond en
sortie (`#hideLoader`). Le mécanisme s'appuie sur trois éléments fournis par le socle :

- `.data-table-frame--loading` : posé au premier rendu, il masque la table (opacité 0) tant
  que les lignes ne sont pas dessinées, puis est retiré. Un `min-height` évite le saut de
  hauteur.
- `.data-table-loader` : l'overlay plein cadre contenant l'illustration
  `table-coming-soon.svg` (`alt` = clé `loading` du domaine `dataTable`).
- `.data-table-loader--hidden` : état masqué (opacité 0 + `visibility`), basculé pour le
  **fondu croisé** entre la table (0 → 1) et l'overlay (1 → 0).

Le style vit dans `assets/styles/modules/_datatable-loader.scss` ; les erreurs éventuelles
(ex. tri initial illisible) sont envoyées à **Sentry**, jamais avalées.

**En-tête collant** (`dt_sticky_header`, opt-in). Quand il est activé, le contrôleur pose un
*sentinel* de hauteur nulle en haut de la zone de défilement et l'observe via un
`IntersectionObserver` calé sur la hauteur du header d'application. Dès que le sentinel passe
sous le header, la classe `data-table--stuck` est posée (épinglage des `<th>` + ombre de
navigation invitant à remonter) ; elle est retirée au retour en haut.

## 14. Comportement mobile

Sous `768px`, la table bascule en mode « accordéon » : chaque ligne devient une carte
dont seule la cellule `data-mobile-title` reste visible ; un tap la déploie / replie.
Les colonnes `data-mobile-hide` sont retirées de la vue.

## 15. Internationalisation

Tous les libellés de l'UI DataTables vivent dans un **domaine de traduction dédié**
`dataTable` (fichier `translations/dataTable+intl-icu.fr.yaml`), séparé du domaine
`messages`. Les clés y sont courtes (`search`, `emptyTable`, `info`, `lengthMenu`,
`paginate.*`, `filter`, `selected`, …). Ce fichier fait partie du socle à copier.

On y accède en précisant explicitement le domaine :

- côté JS : `translate('search', {}, 'dataTable')` ;
- côté Twig : `{{ 'filter'|trans({}, 'dataTable') }}`.

Deux clés existent sans être affichées : `infoFiltered` est volontairement forcée à la
chaîne vide par le contrôleur (le « filtrées depuis un total de… » natif n'a pas de sens en
server-side, où `recordsTotal` ne compte que la page), et `zeroRecords` / `emptyTable`
couvrent respectivement « aucun résultat pour cette recherche » et « table vide ».

## 16. Checklist « nouvelle table »

1. **Template** : étendre `dataTable/layout.html.twig`, poser `dt_url_populate` et les
   `<th data-column-name="…">`.
2. **Route** : ajouter une action GET `#[MapQueryParameter]` protégée par un Voter,
   qui transmet les paramètres au manager et construit la `JsonResponse`.
3. **Manager** : orchestrer périmètre / droits, appeler le repository puis le formatter,
   renvoyer la réponse DataTables.
4. **Repository** : étendre `DatatableRepository`, écrire `getXxxDataForDatatable()`
   avec un `AS <alias>` par colonne + `search` + `setMaxResults`/`setFirstResult`, puis
   `return $this->formatResults(...)`.
5. **Formatter** *(si besoin)* : un service dans `src/Service/Format/`, étendant
   `AbstractDataTableRowFormatter` dès que l'habillage dépend des droits sur l'entité de la
   ligne (prévoir alors l'alias technique de l'id dans le SELECT).
6. **Traductions** : une clé pour chaque libellé de colonne / filtre.
7. **Rafraîchissement** *(si la page crée / supprime des lignes)* : émettre `dt.refresh`
   sur la table depuis le contrôleur JS concerné (§12).
