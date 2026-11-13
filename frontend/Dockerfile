# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first (cached unless package files change).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Empty API URL = same origin: nginx proxies /api to the backend container,
# so the browser never makes a cross-origin request in this setup.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
