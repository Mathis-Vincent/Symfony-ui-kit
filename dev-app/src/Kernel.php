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

namespace MVincent\UiKitBundle\DevApp;

use MVincent\UiKitBundle\MVincentUiKitBundle;
use Symfony\Bundle\FrameworkBundle\FrameworkBundle;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Bundle\TwigBundle\TwigBundle;
use Symfony\Bundle\WebProfilerBundle\WebProfilerBundle;
use Symfony\Component\Config\Loader\LoaderInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpKernel\Kernel as BaseKernel;
use Symfony\Component\Routing\Loader\Configurator\RoutingConfigurator;
use Symfony\UX\StimulusBundle\StimulusBundle;
use Symfony\WebpackEncoreBundle\WebpackEncoreBundle;

/**
 * Micro-kernel of the development playground.
 *
 * It exists only to render the kit in a browser while working on it: it is declared in
 * `autoload-dev`, so it is never autoloaded in a project that installs the bundle, and the
 * whole `dev-app/` directory is `export-ignore`d, so it is not even present in the archive
 * Composer downloads.
 */
class Kernel extends BaseKernel
{
    use MicroKernelTrait;

    public function registerBundles(): iterable
    {
        yield new FrameworkBundle();
        yield new TwigBundle();
        yield new StimulusBundle();
        yield new WebpackEncoreBundle();
        yield new MVincentUiKitBundle();

        if ($this->isDebug() && class_exists(WebProfilerBundle::class)) {
            yield new WebProfilerBundle();
        }
    }

    public function getProjectDir(): string
    {
        return \dirname(__DIR__);
    }

    private function configureContainer(ContainerBuilder $container, LoaderInterface $loader): void
    {
        $loader->load($this->getProjectDir().'/config/packages/*.yaml', 'glob');

        $container->register(Controller\DemoController::class, Controller\DemoController::class)
            ->setAutowired(true)
            ->setAutoconfigured(true)
            ->setPublic(true)
        ;
    }

    private function configureRoutes(RoutingConfigurator $routes): void
    {
        $routes->import(Controller\DemoController::class, 'attribute');

        if ($this->isDebug() && class_exists(WebProfilerBundle::class)) {
            $routes->import('@WebProfilerBundle/Resources/config/routing/wdt.xml')->prefix('/_wdt');
            $routes->import('@WebProfilerBundle/Resources/config/routing/profiler.xml')->prefix('/_profiler');
        }
    }
}
