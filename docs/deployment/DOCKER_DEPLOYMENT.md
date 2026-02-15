# Docker Deployment Guide

## Overview

This guide covers deploying Stormglass using Docker and Docker Compose on a VPS.

## Prerequisites

- Docker and Docker Compose installed
- VPS with at least 2GB RAM
- Domain name (for HTTPS)
- PostgreSQL (managed service or self-hosted)
- Mosquitto MQTT broker (optional, for Pi sensors)

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
      MQTT_BROKER_URL: ${MQTT_BROKER_URL}
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
MQTT_BROKER_URL=mqtt://mosquitto:1883
VITE_API_URL=https://example.com
VITE_WS_URL=wss://example.com
```

## Deployment Steps

### 1. Prepare VPS

```bash
ssh root@your-vps
apt update && apt upgrade -y
apt install -y docker.io docker-compose curl

# Enable Docker daemon
systemctl enable docker
systemctl start docker
```

### 2. Clone and Configure

```bash
cd /opt
git clone <your-repo> stormglass
cd stormglass
cp .env.production .env

# Edit .env with your secrets
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
# Install Caddy
apt install -y caddy

# Copy config
cp Caddyfile /etc/caddy/

# Enable auto-renewal
systemctl enable caddy
systemctl start caddy

# Check status
systemctl status caddy
```

## Monitoring

### View Logs

```bash
docker-compose logs app              # App logs
docker-compose logs postgres         # Database logs
docker-compose logs -f               # Follow all logs
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

## Scaling Considerations

### Horizontal Scaling (Multiple Instances)
- Use load balancer (nginx, HAProxy)
- Share PostgreSQL instance
- Use Redis for session state (if needed)

### Database Optimization
- Index frequently queried columns
- Archive old data periodically
- Monitor query performance

## Security

- Use strong database passwords
- Enable HTTPS (Caddy handles this)
- Restrict MQTT access (firewall rules)
- Keep Docker images updated
- Use secrets management for production keys

## Troubleshooting

### App won't start
```bash
docker-compose logs app
docker-compose exec app npm run db:migrate
```

### Database connection failed
```bash
docker-compose logs postgres
docker-compose exec postgres psql -U stormglass -c "SELECT 1;"
```

### SSL certificate issues
```bash
caddy reload
certbot renew --dry-run
```
