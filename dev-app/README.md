# Playground de développement

Petite application Symfony servant **uniquement** à voir et retoucher le kit dans un
navigateur pendant qu'on le développe. Elle n'est jamais installée chez les consommateurs
du bundle (voir « Pourquoi elle n'arrive jamais chez le consommateur » plus bas).

Aucune base de données : les trois modules sont alimentés par un jeu de données en mémoire
(`src/Controller/DemoController.php`), avec les mêmes contrats JSON qu'un vrai projet.

## Démarrer avec Docker (recommandé, aucun prérequis local)

Depuis la racine du bundle :

```bash
make install   # composer install + assets:install, dans le conteneur PHP
make up        # http://localhost:8123 + watcher webpack
make logs      # suivre la compilation des assets
make down
```

Le port se change avec `PLAYGROUND_PORT=9000 make up`. Le conteneur PHP tourne avec ton
UID/GID (passés en build args), donc les fichiers créés dedans restent éditables dehors.

## Démarrer sans Docker

Nécessite PHP 8.3+ et Node 20+ sur la machine. Depuis la **racine du bundle** :

```bash
composer install                     # installe aussi les require-dev (Encore, Stimulus, profiler)
php dev-app/bin/console assets:install dev-app/public
npm install --prefix dev-app
npm run --prefix dev-app watch       # laisser tourner : recompile à chaque modification
```

Puis, dans un second terminal :

```bash
php -S 127.0.0.1:8123 -t dev-app/public
# ou, avec le CLI Symfony : symfony server:start --document-root=dev-app/public
```

- http://127.0.0.1:8123/ — sommaire
- `/datatable` — table server-side (tri, pagination, recherche, filtre, menu de longueur)
- `/card-list` — grille de cartes (recherche, filtre offcanvas, « charger plus » / « tout charger »)
- `/chart` — graphique Chart.js alimenté en inline

## Boucle de travail

Webpack est configuré avec un alias `@mvincent/ui-kit` → `../assets` : les contrôleurs
Stimulus et le SCSS **du bundle** sont recompilés directement, sans copie ni `npm link`.
Les templates Twig et le PHP du bundle sont lus depuis `../templates` et `../src`. Modifier
le bundle et rafraîchir la page suffit.

Les pages de démo sont volontairement minimales : elles n'écrivent que le `{% extends %}`
et les `{% set %}`, comme une page de projet réel. Si une démo devient longue, c'est le
signe que le layout du bundle manque d'un réglage.

## Pourquoi elle n'arrive jamais chez le consommateur

Quatre barrières, indépendantes :

1. **`export-ignore`** — `/dev-app`, `/docker`, `/compose.yaml`, `/Makefile` et `/.github`
   sont marqués `export-ignore` dans le `.gitattributes` du bundle. `composer require`
   télécharge par défaut l'archive *dist* (générée par `git archive`), qui les exclut : les
   fichiers ne sont même pas sur le disque.
2. **`autoload-dev`** — le namespace `MVincent\UiKitBundle\DevApp\` est déclaré dans
   `autoload-dev`, section que Composer ignore pour un paquet installé en dépendance. Même
   présents, ces fichiers ne sont pas autoloadés.
3. **`require-dev`** — Encore, StimulusBundle et le profiler ne sont installés que quand on
   travaille *sur* le bundle, jamais quand on l'installe.
4. **La CI le vérifie** — le job `dist` de `.github/workflows/ci.yaml` reconstruit l'archive
   avec `git archive` à chaque push et échoue si l'outillage de dev s'y trouve, ou si un
   fichier du bundle en est absent.

Cas particulier : si le projet consommateur déclare le bundle en dépôt `path`
(symlink) ou installe en `--prefer-source`, le dossier `dev-app/` **est** physiquement
présent. Il reste inerte — rien ne l'autoloade, son `Kernel` n'est pas dans le
`config/bundles.php` du projet, et son `public/index.php` n'est pas exposé par le serveur
web du projet. Rien à faire de plus.
