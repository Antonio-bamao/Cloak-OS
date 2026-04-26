FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
