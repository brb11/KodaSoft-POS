# ─────────────────────────────────────────────
# Casheer Site — static marketing site
# ─────────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/ ./apps/
COPY packages/ ./packages/

# Public URL of the POS web app (used for the Login / Get started buttons).
ARG PUBLIC_APP_URL=http://localhost
ENV PUBLIC_APP_URL=$PUBLIC_APP_URL
# Canonical URL of the marketing site (used by Astro for SEO/sitemap).
ARG SITE_URL=https://casheer.kodasoft.sa
ENV SITE_URL=$SITE_URL

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @casheer/site build

FROM nginx:1.27-alpine
COPY --from=build /app/apps/site/dist /usr/share/nginx/html
COPY apps/site/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
