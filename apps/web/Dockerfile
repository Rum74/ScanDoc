# Multi-stage Dockerfile for ScanDoc Web Frontend
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve static via Nginx/Alpine
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA and PWA service worker caching
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Cache static assets\n\
    location ~* \\.(?:ico|css|js|gif|jpe?g|png|svg|woff2?)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
\n\
    # Do not cache service worker and manifest\n\
    location ~* (?:sw\\.js|manifest\\.webmanifest)$ {\n\
        expires -1;\n\
        add_header Cache-Control "no-store, no-cache, must-revalidate";\n\
    }\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
