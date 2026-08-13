# Module Chart

Ce guide décrit le module Chart : un socle que l'on copie une seule fois, puis un plan de
câblage à répéter pour chaque nouveau graphique. L'objectif est d'obtenir une carte
contenant un graphique **Chart.js** (camembert, barres, courbe…) **avec le minimum de code
par page**.

C'est le troisième membre de la famille des listes déclaratives, aux côtés de DataTables
(`datatables.md`) et CardList (`cardList.md`) : même philosophie — le template **déclare**,
le contrôleur JS **consomme**, le back **produit un DTO sérialisable** — mais là où les deux
autres rendent des lignes ou des cartes, Chart rend un `<canvas>`.

## 1. Architecture en 5 couches

| Couche | Fichier de référence | Rôle |
|---|---|---|
| **Template Twig** | `@MVincentUiKit/chart/layout.html.twig` | Déclare le type de graphique, la source des données et la légende via des `{% set %}`. C'est ce template qu'une page **étend**. |
| **Contrôleur Stimulus** | `assets/controllers/generic/chart_controller.js` | Lit la config depuis les `data-*`, récupère les données (inline ou AJAX), attribue les couleurs manquantes, instancie Chart.js et rend la légende HTML. |
| **DTO PHP** | `src/DTO/Chart/ChartData.php` + `ChartDataset.php` | Le contrat de données, `JsonSerializable` : c'est le **seul** format que le front sait consommer. |
| **Manager PHP** | ex. `Manager/Controller/DashboardManager.php` | Transforme les lignes du repository en `ChartData` (libellés, valeurs, couleurs métier, traductions). C'est ici que vit la logique. |
| **Repository PHP** | ex. `Repository/SiteRepository.php` | Renvoie les données agrégées brutes (`GROUP BY` + `count()`), sans notion de graphique. |

Le flux : le template **déclare** la config → le layout la **traduit** en attributs HTML sur
le `<canvas>` → le contrôleur JS la **consomme**, lit le JSON (inline ou AJAX) → complète les
**couleurs** manquantes → instancie **Chart.js** → masque le loader → rend la **légende HTML**
si nécessaire.

## 2. Contenu du module

### Socle réutilisable (fourni par le bundle, rien à copier)

Ces fichiers sont **génériques** : ils vivent dans le bundle `mvincent/ui-kit-bundle`,
ne connaissent aucune entité et se partagent d'un projet à l'autre sans modification.

- `@MVincentUiKit/chart/layout.html.twig` — le layout de graphique étendable (canvas + légende +
  loader), qui hérite de `@MVincentUiKit/partials/card/_card.html.twig`.
- `assets/controllers/generic/chart_controller.js` — le contrôleur Stimulus.
- `src/DTO/Chart/ChartData.php` et `src/DTO/Chart/ChartDataset.php` — le contrat de données.
- Les styles `assets/styles/modules/charts/_charts.scss` (BEM : `chart-container`
  + son modifieur `--with-legend`, et `chart-legend__*`) et
  `assets/styles/modules/_chart-loader.scss` (illustration + overlay),
  tous deux importés par `compile.scss`.
- L'illustration `public/images/loading/chart-coming-soon.svg`, servie en overlay
  pendant le chargement (cf. §8).
- `@MVincentUiKit/partials/_chart_loader.html.twig` — la même illustration **sans** overlay, pour
  afficher un « graphique à venir » en dehors du module (emplacement réservé, carte non
  encore alimentée).
- Les clés de traduction du domaine `chart` (`translations/chart+intl-icu.fr.yaml`).

### Prérequis (dépendances front)

Le contrôleur Stimulus étend `BaseController` et s'appuie sur :

```js
import axios from "axios";
import { Chart, registerables } from 'chart.js';
import * as Sentry from "@sentry/browser";
```

Tous les contrôleurs / éléments Chart.js sont enregistrés une fois
(`Chart.register(...registerables)`), et la police par défaut est alignée sur celle de
Bootstrap (`--bs-font-sans-serif`) : un nouveau graphique n'a donc **rien** à configurer.

### À créer pour chaque graphique

1. Un **template** qui étend `chart/layout.html.twig` (type + source + légende + titre).
2. Une **méthode de repository** renvoyant les données agrégées brutes.
3. Une **méthode de manager** qui construit la `ChartData`.
4. *(mode AJAX uniquement)* une **route GET** renvoyant cette `ChartData` en `JsonResponse`.

## 3. Le contrat front ↔ back

Le front ne sait lire qu'**une** structure, celle produite par `ChartData` :

```json
{
  "labels": ["Site A", "Site B"],
  "datasets": [
    { "label": "Tags par site", "data": [42, 17], "backgroundColor": ["#009ef7", "#50cd89"] }
  ]
}
```

| Clé | Type | Contenu |
|---|---|---|
| `labels` | `string[]` | Un libellé par part / barre / point. **Déjà traduit** côté back. |
| `datasets` | `ChartDataset[]` | Un objet par série. Un camembert n'en a qu'un ; une courbe multi-séries en a plusieurs. |
| `datasets[].label` | string | Nom de la série (utilisé par les info-bulles Chart.js). |
| `datasets[].data` | `int[]` | Les valeurs, **dans l'ordre des `labels`**. |
| `datasets[].backgroundColor` | `string[]` | Optionnel : couleur par part. **Omis de la sérialisation quand il est vide**, et c'est alors le front qui colore (§6). |

Deux règles à ne jamais casser :

- `labels` et chaque `data` ont la **même longueur** et le **même ordre** — c'est l'index qui
  fait le lien, pas une clé ;
- un `datasets` **vide** (ou des `labels` vides) est traité comme « pas de données » : le
  graphique n'est pas instancié, seul le loader disparaît (§8).

## 4. Exemple minimal complet

### 4.1 Template (`templates/pages/xxx/mon_graphique.html.twig`)

```twig
{% extends "@MVincentUiKit/chart/layout.html.twig" %}

{% set ch_type = 'pie' %}
{% set ch_json = chart|json_encode %}
{% set ch_html_legend = true %}

{% block card_title %}
    {{ 'dashboard.admin.tag_per_site.title'|trans }}
{% endblock %}
```

Le template n'a besoin que d'**une source** (`ch_json` ou `ch_url_populate`) : sans elle, le
contrôleur remonte l'anomalie à Sentry et affiche une erreur à l'utilisateur.

La carte est ensuite incluse en lui passant la `ChartData` :

```twig
{% include 'pages/dashboard/composants/tags_per_site.html.twig' with {chart: tagsPerSiteChart} %}
```

### 4.2 Repository

Le repository ne connaît pas le graphique : il renvoie des lignes agrégées.

```php
/** @return array<int, array{total_tags: int, name: string}> */
public function getChartDataTagPerSiteAsArray(): array
{
    return $this
        ->getQueryBuilderOnlyActives()
        ->select('count(t.id) as total_tags')
        ->addSelect('s.name as name')
        ->innerJoin('s.tags', 't')
        ->groupBy('s.id')
        ->orderBy('total_tags', 'DESC')
        ->getQuery()
        ->getArrayResult();
}
```

**Trier côté SQL** (`ORDER BY count DESC`) : l'ordre des parts est une donnée, pas une
décision du front.

### 4.3 Manager

Le manager **produit le DTO** : il déplie les lignes en `labels` / `data` et traduit le titre
de la série.

```php
/** @param array<int, array{total_tags: int, name: string}> $rows */
private function buildTagsChart(array $rows, string $title): ChartData
{
    $labels = [];
    $values = [];
    foreach ($rows as $row) {
        $labels[] = $row['name'];
        $values[] = $row['total_tags'];
    }

    return new ChartData($labels, [new ChartDataset($title, $values)]);
}
```

> ⚠️ **Où construire la `ChartData`** : dans un **manager**. Deux méthodes historiques
> (`AbstractBaseController::preprareTagStatusChartData()` et
> `preprareBatteryPercentageChartData()`) construisent encore leurs graphiques depuis le
> contrôleur ; elles restent en place pour les pages existantes mais ne servent **pas** de
> modèle : un contrôleur ne manipule pas les données.

### 4.4 Les DTO

`ChartData` et `ChartDataset` sont `readonly` et `JsonSerializable` : ils se passent
directement à `json_encode` (mode inline) comme à une `JsonResponse` (mode AJAX).

```php
readonly class ChartDataset implements \JsonSerializable
{
    /**
     * @param int[]    $data
     * @param string[] $backgroundColor per-slice colors; when empty the presentation layer assigns them
     */
    public function __construct(
        public string $label,
        public array $data,
        public array $backgroundColor = [],
    ) {
    }
}
```

`jsonSerialize()` **omet** `backgroundColor` quand il est vide : c'est ce qui permet au front
de distinguer « le back impose ses couleurs » de « le back s'en moque » (§6).

## 5. Les deux modes d'alimentation

| Mode | Déclaration | Quand l'utiliser |
|---|---|---|
| **Inline** | `ch_json` | Le cas général : la `ChartData` est déjà calculée pour la page, on la sérialise dans `data-json` au rendu Twig. Aucune requête supplémentaire. |
| **AJAX** | `ch_url_populate` | Quand la donnée est lourde et ne doit pas bloquer l'affichage de la page : le contrôleur fait un `GET` (axios) au `connect()` et construit le graphique à la réponse. |

Les deux sont exclusifs : si `ch_url_populate` est présent, `ch_json` est ignoré.

> ⚠️ **État du mode AJAX** : le layout et le contrôleur le gèrent, mais aucune carte du
> projet ne l'utilise encore. La seule route existante (`app_dashboard_chart_tags`) renvoie
> un `datasets` sous forme d'**objet** (`{data: [...]}`) au lieu d'un **tableau** de datasets ;
> le contrôleur la voit donc comme « pas de données » et n'affiche rien. Avant de bâtir sur
> ce mode : faire renvoyer une `ChartData` par la route (`new JsonResponse($chartData)`).

## 6. Couleurs

Le contrôleur applique la **première** source disponible, dans cet ordre :

1. **`backgroundColor` du dataset** — le back impose ses couleurs. À utiliser dès que la
   couleur porte du **sens métier** : dégradé rouge → vert des états de tag, niveau de
   batterie, etc.
2. **Palette du template** (`ch_colors`) — une couleur est **tirée au hasard** dans la
   palette pour chaque part.
3. **Couleur aléatoire pure** — aucune palette déclarée : chaque part reçoit un `#rrggbb`
   aléatoire.

```twig
{% set ch_colors = ['#009ef7', '#50cd89', '#ffc700', '#f1416c', '#7239ea', '#00c2c7', '#f47b20', '#a1a5b7'] %}
```

> ⚠️ **Limite connue** : la palette est **tirée aléatoirement** part par part, pas parcourue
> dans l'ordre. Deux parts voisines peuvent donc recevoir la même couleur, et les couleurs
> changent d'un rechargement à l'autre. Dès que la lisibilité ou la stabilité compte, envoyez
> les couleurs depuis le back via `ChartDataset::$backgroundColor`.

## 7. Configuration du template (`{% set %}`)

Ces variables se déclarent en haut du template ; le layout les transforme en attributs
`data-*` sur le `<canvas>`.

| Variable | Type | Défaut | Obligatoire | Effet |
|---|---|---|---|---|
| `ch_json` | string (JSON) | — | ✅ *(ou `ch_url_populate`)* | Données inline, typiquement `chart\|json_encode` d'une `ChartData`. |
| `ch_url_populate` | URL | — | ✅ *(ou `ch_json`)* | Route GET renvoyant la même structure JSON. Prioritaire sur `ch_json`. |
| `ch_type` | string | `'pie'` | ❌ | Type Chart.js (`pie`, `doughnut`, `bar`, `line`, …). Tous les types sont enregistrés. |
| `ch_html_legend` | bool | `false` | ❌ | Force la légende HTML cliquable et passe le conteneur en `chart-container--with-legend` (canvas plafonné, légende sous le graphique). |
| `ch_colors` | array | — | ❌ | Palette de couleurs (§6). |

## 8. Blocs Twig disponibles

Le layout occupe `card_body` : **ne le surchargez pas**. Restent les blocs de la carte
(`partials/card/_card.html.twig`) :

| Bloc | Rôle |
|---|---|
| `card_title` | Titre de la carte (le cas usuel). |
| `card_header` | En-tête personnalisé complet (prioritaire sur `card_title`). |
| `card_filters` | Zone de filtres. |
| `card_actions` | Boutons d'action libres. |

Si les quatre sont vides, l'en-tête de la carte n'est pas rendu.

## 9. Légende

Deux légendes possibles :

- **native Chart.js** — le défaut ;
- **HTML** (`chart-legend`) — une liste `<ul>` construite par le contrôleur depuis
  `generateLabels()`, avec une pastille de couleur et un libellé tronqué (`text-overflow`).
  Un clic sur un item appelle `toggleDataVisibility()` et bascule la classe
  `chart-legend__item--hidden` (barré + estompé).

La légende HTML s'active **si la cible `legend` existe** et que l'une des deux conditions est
vraie :

- le template a posé `ch_html_legend` ;
- il y a **plus de 8 libellés** (`LEGEND_ITEM_LIMIT`) — au-delà, la légende native mange la
  place du graphique, donc le basculement est automatique.

Quand la légende HTML est active, la native est masquée et `maintainAspectRatio` est activé
(le canvas garde son ratio, la légende défile de son côté : `max-height: 200px`).

## 10. États : chargement, données vides et erreurs

Le layout fournit un overlay (`chart-loader chart-loader--overlay`) posé **par-dessus** le
canvas, contenant l'illustration `chart-coming-soon.svg`. Le contrôleur ne le masque
(`chart-loader--hidden`) qu'une fois le graphique construit — ou l'absence de données
constatée.

| Situation | Comportement |
|---|---|
| Données présentes | Graphique instancié, puis loader masqué. |
| Réponse AJAX sans `labels` ou sans `datasets` | Aucun graphique, loader masqué : la carte reste vide. |
| Erreur réseau / réponse non-objet | `Sentry.captureException()` + loader masqué (pas de pop-up : un graphique absent ne doit pas bloquer la page). |
| `data-json` illisible | `Sentry.captureException()` + `showErrorHappened()` (pop-up SweetAlert) : le JSON vient de notre propre rendu, c'est un bug à signaler. |
| Aucune source déclarée | `Sentry.captureMessage()` + `showErrorHappened()`. |

Au `disconnect()`, le contrôleur **détruit** l'instance Chart.js et vide la légende : c'est ce
qui permet de recharger une page en Turbo / de retirer une carte sans fuite de canvas.

## 11. Internationalisation

- **Domaine `chart`** (`translations/chart+intl-icu.fr.yaml`) — les libellés de l'**UI
  générique** du module : `loader.title` (texte alternatif de l'illustration). Ce fichier fait
  partie du socle à copier.
- **Domaine `messages`** (ou un domaine métier) — le **titre de la carte** (`card_title`) et,
  surtout, les **libellés de données** : `labels` et `datasets[].label` arrivent **déjà
  traduits** depuis le back, car le front ne fait que les afficher.

Un graphique dont les libellés viennent d'un enum se traduit donc dans le manager
(`$this->translator->trans($state->getLabelKey())`), jamais côté JS.

## 12. Checklist « nouveau graphique »

1. **Repository** : une méthode renvoyant les lignes agrégées (`GROUP BY` + `count()`),
   triées côté SQL.
2. **Manager** : construire la `ChartData` — `labels` traduits, `data` dans le même ordre, et
   `backgroundColor` **uniquement** si la couleur porte du sens métier.
3. **Template** : étendre `chart/layout.html.twig`, poser `ch_type`, la source
   (`ch_json` ou `ch_url_populate`), `ch_html_legend` si beaucoup de libellés, `ch_colors` si
   la palette du back n'est pas fournie, et le bloc `card_title`.
4. **Page** : inclure la carte en lui passant la `ChartData` (`with {chart: monChart}`).
5. **Route** *(mode AJAX uniquement)* : une action GET protégée par un Voter, qui renvoie
   `new JsonResponse($chartData)`.
6. **Traductions** : titre de carte et libellés de données dans le domaine métier ; rien à
   ajouter dans le domaine `chart`.
