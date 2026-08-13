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

namespace MVincent\UiKitBundle;

use Symfony\Component\Config\Definition\Configurator\DefinitionConfigurator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;

/**
 * Registers the UI kit: Twig layouts under the `@MVincentUiKit` namespace, the `cardList`,
 * `chart` and `dataTable` translation domains, and the assets shipped in `public/`
 * (published to `public/bundles/mvincentuikit` by `assets:install`).
 */
class MVincentUiKitBundle extends AbstractBundle
{
    protected string $extensionAlias = 'mvincent_ui_kit';

    /** The bundle root is one level above src/, so templates/, translations/ and public/ are found. */
    public function getPath(): string
    {
        return \dirname(__DIR__);
    }

    public function configure(DefinitionConfigurator $definition): void
    {
        $definition->rootNode()
            ->children()
                ->scalarNode('asset_path')
                    ->defaultValue('bundles/mvincentuikit')
                    ->info('Public base path of the kit assets, as published by `bin/console assets:install`.')
                ->end()
                ->scalarNode('stimulus_prefix')
                    ->defaultValue('generic--')
                    ->info('Prefix of the Stimulus controller names (generic--datatables, generic--chart, ...).')
                ->end()
                ->scalarNode('base_layout')
                    ->defaultValue('@MVincentUiKit/layout/app.html.twig')
                    ->info('Layout the full-page CardList layout extends. Point it at your own application layout.')
                ->end()
            ->end()
        ;
    }

    /**
     * @param array{asset_path: string, stimulus_prefix: string, base_layout: string} $config
     */
    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        $builder->setParameter('mvincent_ui_kit.asset_path', rtrim($config['asset_path'], '/'));
        $builder->setParameter('mvincent_ui_kit.stimulus_prefix', $config['stimulus_prefix']);
        $builder->setParameter('mvincent_ui_kit.base_layout', $config['base_layout']);

        $container->import('../config/services.php');
    }
}
