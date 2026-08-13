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

use MVincent\UiKitBundle\Twig\UiKitGlobalsExtension;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;

use function Symfony\Component\DependencyInjection\Loader\Configurator\param;

// The abstract building blocks (DatatableRepository, AbstractDataTableRowFormatter, the DTOs
// and the trait) are meant to be extended by the host application and are autowired there,
// so the only service the bundle registers is the Twig globals extension.
return static function (ContainerConfigurator $container): void {
    $container->services()
        ->set('mvincent_ui_kit.twig.globals', UiKitGlobalsExtension::class)
            ->args([
                param('mvincent_ui_kit.asset_path'),
                param('mvincent_ui_kit.stimulus_prefix'),
                param('mvincent_ui_kit.base_layout'),
            ])
            ->tag('twig.extension')
    ;
};
