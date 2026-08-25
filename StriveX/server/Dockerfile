FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npx nest build

FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY public ./public
VOLUME /app/data
ENV DB_PATH=/app/data/strivex.db
EXPOSE 3000
CMD ["node", "dist/main.js"]
