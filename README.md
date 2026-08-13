# MVincent UI Kit Bundle

Bundle Symfony réutilisable regroupant trois modules d'affichage **déclaratifs**, pensés pour
écrire le minimum de code par page :

| Module | Ce qu'il rend | Doc |
|---|---|---|
| **DataTables** | table paginée / triée / filtrée côté serveur | [docs/datatables.md](docs/datatables.md) |
| **CardList** | grille de cartes avec recherche, filtres et « charger plus » | [docs/cardList.md](docs/cardList.md) |
| **Chart** | carte contenant un graphique Chart.js | [docs/charts.md](docs/charts.md) |

Chaque module suit la même philosophie : le **template Twig déclare**, le **contrôleur Stimulus
consomme**, le **back répond en JSON**.

## Contenu

```
src/                MVincent\UiKitBundle\ — DTO, repositories abstraits, trait, extension Twig
config/             services du bundle
templates/          layouts Twig, namespace @MVincentUiKit
translations/       domaines cardList, chart, dataTable (fr)
assets/             contrôleurs Stimulus, SCSS, entrypoint @mvincent/ui-kit
public/             illustrations de chargement + sons (publiés par assets:install)
docs/               les trois guides de référence
examples/           application de démonstration (hors autoload, ne sert que de doc vivante)
```

## Installation

### 1. Le paquet

Le bundle n'est pas publié sur Packagist : déclarer un dépôt `path` (ou `vcs`) dans le
`composer.json` du projet hôte.

```json
{
    "repositories": [
        { "type": "path", "url": "../MVincent-ui-kit" }
    ]
}
```

```bash
composer require mvincent/ui-kit-bundle:@dev
```

### 2. Activer le bundle

Si Flex ne l'a pas fait, ajouter dans `config/bundles.php` :

```php
MVincent\UiKitBundle\MVincentUiKitBundle::class => ['all' => true],
```

### 3. Publier les assets publics (illustrations + sons)

```bash
php bin/console assets:install public
```

Les fichiers atterrissent dans `public/bundles/mvincentuikit/`.

### 4. Configuration (optionnelle)

`config/packages/mvincent_ui_kit.yaml` :

```yaml
mvincent_ui_kit:
    # base publique des assets du kit
    asset_path: 'bundles/mvincentuikit'
    # préfixe des noms de contrôleurs Stimulus
    stimulus_prefix: 'generic--'
    # layout dont hérite la page CardList — à pointer sur le layout de l'application
    base_layout: 'base.html.twig'
```

### 5. Le front

Le `package.json` du projet hôte référence les assets du bundle :

```json
{
    "dependencies": {
        "@mvincent/ui-kit": "file:vendor/mvincent/ui-kit-bundle/assets"
    }
}
```

Puis, au démarrage de l'application Stimulus :

```js
import { Application } from '@hotwired/stimulus';
import { registerUiKitControllers, setTranslator } from '@mvincent/ui-kit';
import { createTranslator } from '@symfony/ux-translator';
import { localeFallbacks, messages } from '../var/translations';

const translator = createTranslator({ messages, locale: 'fr', localeFallbacks });
setTranslator((key, params, domain) => translator.trans(key, params, domain));

const application = Application.start();
registerUiKitControllers(application); // même préfixe que `stimulus_prefix`
```

Sans `setTranslator()`, le kit affiche les clés de traduction brutes — rien ne casse.

Et dans le SCSS de l'application :

```scss
@import "~@mvincent/ui-kit/styles/variables/palette"; // avant Bootstrap
@import "~bootstrap/scss/bootstrap";
@import "~@mvincent/ui-kit/styles/ui-kit";
```

Toutes les variables de la palette sont `!default` : les redéclarer avant l'import du
partial `palette` suffit à restyler les trois modules.

Si ton webpack aliase le kit depuis un chemin situé hors du projet (monorepo, dépôt `path`),
ajoute `config.resolve.modules = [path.resolve(__dirname, 'node_modules'), 'node_modules']`
pour que les imports du kit (`axios`, `chart.js`, …) se résolvent dans **tes** node_modules.
Depuis `vendor/`, la résolution par défaut suffit.

#### Dépendances front

`@hotwired/stimulus`, `@floating-ui/dom`, `axios`, `bootstrap`, `chart.js`, `datatables.net-bs5`,
`datatables.net-select-bs5`, `sweetalert2`, `@sentry/browser` — déclarées en
`peerDependencies` dans `assets/package.json`.

## Utilisation

Une page étend le layout du module voulu et ne déclare que sa configuration :

```twig
{% extends "@MVincentUiKit/dataTable/layout.html.twig" %}

{% set dt_url_populate = url('app_articles_list_datatable') %}
{% set dt_page_length = 25 %}
{% set dt_active_search = true %}
```

Côté PHP, les briques à étendre :

- `MVincent\UiKitBundle\Repository\DatatableRepository` — repository DataTables (tri sécurisé,
  pagination, assemblage de la réponse) ;
- `MVincent\UiKitBundle\Repository\Trait\CardListQueryTrait` — recherche + pagination CardList ;
- `MVincent\UiKitBundle\DTO\CardList\CardListQuery` — requête CardList immuable ;
- `MVincent\UiKitBundle\DTO\Chart\ChartData` / `ChartDataset` — contrat de données Chart ;
- `MVincent\UiKitBundle\Service\Format\AbstractDataTableRowFormatter` — formatage de lignes.

Le dossier `examples/` contient une application complète (entités `Article` / `Category`,
contrôleur, manager, repository, formatter, templates) qui câble les trois modules. Il est
**exclu de l'autoload** : il se lit, il ne s'exécute pas.

## Développer le bundle

Le dossier `dev-app/` est une micro-application Symfony qui rend les trois modules dans un
navigateur, sans base de données, avec un alias webpack pointant directement sur les assets
du bundle : on modifie le kit, on rafraîchit, on voit.

Tout tourne dans Docker — **ni PHP ni Node ne sont requis sur la machine** :

```bash
make install   # composer install + publication des assets du bundle
make up        # playground sur http://localhost:8123 + watcher d'assets
make down
```

`make` seul liste les commandes. Sans Docker, les mêmes étapes à la main sont décrites dans
[dev-app/README.md](dev-app/README.md).

Rien de tout cela n'est installé par un `composer require` : `dev-app/`, `docker/`,
`compose.yaml`, `Makefile` et `.github/` sont `export-ignore` (absents de l'archive dist),
le namespace de la playground est en `autoload-dev`, et ses dépendances en `require-dev`.
Un job de CI (`dist`) vérifie à chaque push que cette promesse tient.

## Licence

MIT — voir [LICENSE](LICENSE).
