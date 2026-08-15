# ─────────────────────────────────────────────
# Casheer Site — static marketing site
# ─────────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
# Note: deliberately NOT copying the root .npmrc (node-linker=hoisted). Astro's
# build imports `cookie` by name at runtime; with the hoisted linker pnpm hoists
# the older cookie@0.7.2 (used by Express) to the root and Astro's ESM import of
# `parseCookie` breaks. The site only emits static files, so the default symlink
# linker (which resolves Astro's own cookie@2.0.1) is required here.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/

# Public URL of the POS web app (used for the Login / Get started buttons).
ARG PUBLIC_APP_URL=http://localhost
ENV PUBLIC_APP_URL=$PUBLIC_APP_URL
# Canonical URL of the marketing site (used by Astro for SEO/sitemap).
ARG SITE_URL=https://pos.koda-ye.com
ENV SITE_URL=$SITE_URL

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @casheer/site build

FROM nginx:1.27-alpine
COPY --from=build /app/apps/site/dist /usr/share/nginx/html
COPY apps/site/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
