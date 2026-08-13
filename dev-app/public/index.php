<?php

declare(strict_types=1);

use MVincent\UiKitBundle\DevApp\Kernel;

require dirname(__DIR__, 2).'/vendor/autoload.php';

$kernel = new Kernel($_SERVER['APP_ENV'] ?? 'dev', (bool) ($_SERVER['APP_DEBUG'] ?? true));
$request = Symfony\Component\HttpFoundation\Request::createFromGlobals();
$response = $kernel->handle($request);
$response->send();
$kernel->terminate($request, $response);
