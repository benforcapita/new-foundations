FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @nf/api...
COPY packages/shared/src packages/shared/src
COPY assets/asset_manifest.json assets/localization_en.json assets/
COPY apps/api/src apps/api/src
COPY tsconfig.base.json ./
RUN chown -R node:node /app
USER node
ENV HOST=0.0.0.0
CMD ["pnpm", "--filter", "@nf/api", "start"]
