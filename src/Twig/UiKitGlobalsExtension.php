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

namespace MVincent\UiKitBundle\Twig;

use Twig\Extension\AbstractExtension;
use Twig\Extension\GlobalsInterface;

/**
 * Exposes the bundle configuration to the Twig layouts as a single `mvincent_ui_kit` global,
 * so the templates never hardcode an asset path nor a Stimulus controller name.
 */
final class UiKitGlobalsExtension extends AbstractExtension implements GlobalsInterface
{
    public function __construct(
        private readonly string $assetPath,
        private readonly string $stimulusPrefix,
        private readonly string $baseLayout,
    ) {
    }

    /**
     * @return array{mvincent_ui_kit: array{asset_path: string, stimulus_prefix: string, base_layout: string}}
     */
    public function getGlobals(): array
    {
        return [
            'mvincent_ui_kit' => [
                'asset_path' => $this->assetPath,
                'stimulus_prefix' => $this->stimulusPrefix,
                'base_layout' => $this->baseLayout,
            ],
        ];
    }
}
