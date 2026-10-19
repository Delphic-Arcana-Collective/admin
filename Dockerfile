# Delphic Admin: Next.js static export served by the Go binary.

FROM node:20-alpine AS frontend
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /src/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
ENV NEXT_PUBLIC_BASE_PATH=/admin
ENV NEXT_PUBLIC_API_BASE=/admin
RUN pnpm build

FROM golang:1.27.1-alpine3.24 AS backend
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -ldflags="-w -s" -o /out/delphic_admin ./cmd/admin

FROM alpine:3.24
RUN addgroup --gid 777 --system delphic && adduser --uid 777 --system --ingroup delphic delphic
WORKDIR /app
COPY --from=backend /out/delphic_admin /app/delphic_admin
COPY --from=frontend /src/frontend/out /app/public
COPY docker/config.yaml /app/config.yaml
RUN chown -R delphic:delphic /app
USER delphic
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8081/health >/dev/null || exit 1
CMD ["/app/delphic_admin"]
