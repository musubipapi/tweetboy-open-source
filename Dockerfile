FROM oven/bun:1.3.5 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
RUN bun run build

FROM python:3.12-slim
WORKDIR /app
COPY server.py ./
COPY --from=build /app/public ./public
ENV BIND_HOST=0.0.0.0
CMD ["python3", "server.py"]
