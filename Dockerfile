FROM node:24-bookworm-slim

RUN corepack enable && corepack prepare pnpm@9 --activate

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

CMD ["sleep", "infinity"]