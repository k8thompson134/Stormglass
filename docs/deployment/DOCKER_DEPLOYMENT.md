# Docker Deployment Guide

## Overview

This guide covers deploying Stormglass using Docker and Docker Compose on a VPS.

## Prerequisites

- Docker and Docker Compose installed
- VPS with at least 2GB RAM
- Domain name (for HTTPS)

## Production Docker Setup

### 1. Dockerfile (Backend)

Place in project root:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/

RUN npm ci --workspaces

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Build backend
WORKDIR /app/backend
RUN npm run build

# Runtime
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start", "-w", "backend"]
```

### 2. Docker Compose Production

```yaml
version: '3.8'

services:
  app:
    build: .
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      PORT: 3000
    ports:
      - "127.0.0.1:3000:3000"
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### 3. Caddy Reverse Proxy

Create `Caddyfile`:

```
example.com {
    reverse_proxy localhost:3000 {
        header_uri -Host
        header_up X-Forwarded-For {http.request.remote}
        header_up X-Forwarded-Proto {http.request.proto}
    }

    # WebSocket support
    @websocket {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @websocket localhost:3000

    encode gzip
    file_server /static
}
```

### 4. Environment Variables

Create `.env.production`:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@postgres:5432/stormglass
CORS_ORIGIN=https://example.com
API_TOKEN=your-secret-token
VITE_API_URL=https://example.com
VITE_WS_URL=wss://example.com
```

## Deployment Steps

### 1. Prepare VPS

```bash
ssh root@your-vps
apt update && apt upgrade -y
apt install -y docker.io docker-compose curl

systemctl enable docker
systemctl start docker
```

### 2. Clone and Configure

```bash
cd /opt
git clone <your-repo> stormglass
cd stormglass
cp .env.production .env
nano .env
```

### 3. Build and Run

```bash
docker-compose up -d
docker-compose logs -f

# Run migrations
docker-compose exec app npm run db:migrate
```

### 4. Enable Caddy

```bash
apt install -y caddy
cp Caddyfile /etc/caddy/
systemctl enable caddy
systemctl start caddy
```

## Monitoring

### View Logs

```bash
docker-compose logs app
docker-compose logs postgres
docker-compose logs -f
```

### Health Check

```bash
curl https://example.com/health
```

### Database Backups

```bash
# Manual backup
docker-compose exec postgres pg_dump -U stormglass stormglass > backup.sql

# Restore
cat backup.sql | docker-compose exec -T postgres psql -U stormglass stormglass
```

## Updating

```bash
cd /opt/stormglass
git pull origin main
docker-compose up -d --build
docker-compose exec app npm run db:migrate
docker-compose restart app
```
