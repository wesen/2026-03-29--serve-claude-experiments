FROM golang:1.25-bookworm AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY pkg ./pkg
COPY imports ./imports

# Precompile JSX bundles (uses esbuild via Go, no Node.js needed)
RUN go generate ./pkg/server

RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o /out/serve-artifacts ./cmd/serve-artifacts

FROM gcr.io/distroless/base-debian12:nonroot

WORKDIR /app

LABEL org.opencontainers.image.title="serve-claude-experiments" \
      org.opencontainers.image.description="Claude.ai artifact gallery server" \
      org.opencontainers.image.source="https://github.com/wesen/2026-03-29--serve-claude-experiments"

COPY --from=build /out/serve-artifacts /app/serve-artifacts
COPY --from=build /src/imports /app/imports

EXPOSE 8080

ENTRYPOINT ["/app/serve-artifacts"]
CMD ["serve", "--dir", "/app/imports", "--port", "8080"]
