# ---- Build stage ----
FROM golang:1.24-alpine AS build
WORKDIR /src

# Download dependencies first so this layer is cached between code changes.
COPY go.mod ./
RUN go mod download

COPY . .
# Static binary (no libc) so it can run on a distroless/scratch image.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ---- Runtime stage ----
# Distroless: no shell, no package manager, runs as non-root -> tiny attack surface.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server

ENV PORT=8080
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/server"]
