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

namespace App\Entity;

use App\Repository\ArticleRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ArticleRepository::class)]
class Article
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private string $title;

    #[ORM\Column]
    private int $views = 0;

    #[ORM\Column]
    private int $readingTime = 0;

    #[ORM\Column]
    private \DateTimeImmutable $publishedAt;

    #[ORM\ManyToOne(targetEntity: Category::class)]
    #[ORM\JoinColumn(nullable: false)]
    private Category $category;

    public function __construct(string $title, Category $category, \DateTimeImmutable $publishedAt)
    {
        $this->title = $title;
        $this->category = $category;
        $this->publishedAt = $publishedAt;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function getViews(): int
    {
        return $this->views;
    }

    public function getReadingTime(): int
    {
        return $this->readingTime;
    }

    public function getPublishedAt(): \DateTimeImmutable
    {
        return $this->publishedAt;
    }

    public function getCategory(): Category
    {
        return $this->category;
    }
}
