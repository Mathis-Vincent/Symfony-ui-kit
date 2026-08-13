# Development image of the bundle. Never shipped: `docker/` is export-ignored.
# Highest supported runtime, so the playground exercises the Symfony 8 branch;
# the lower bounds (PHP 8.3, Symfony 6.4) are covered by the CI matrix.
FROM php:8.5-cli-alpine

# intl is not optional: the bundle ships `+intl-icu` translation domains.
# No database driver on purpose — the playground runs on an in-memory dataset.
RUN apk add --no-cache \
        git \
        icu-dev \
        libzip-dev \
        unzip \
    && docker-php-ext-install -j"$(nproc)" \
        intl \
        opcache \
        zip

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Match the host user so files created in the container stay editable outside of it.
ARG UID=1000
ARG GID=1000
RUN addgroup -g "${GID}" -S dev \
    && adduser -u "${UID}" -G dev -S -h /home/dev dev

ENV COMPOSER_HOME=/home/dev/.composer \
    COMPOSER_MEMORY_LIMIT=-1

WORKDIR /app
USER dev

EXPOSE 8000

CMD ["php", "-S", "0.0.0.0:8000", "-t", "dev-app/public"]
