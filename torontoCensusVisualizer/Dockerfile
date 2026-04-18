# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY torontoCensusVisualizer/package*.json ./
RUN npm install

COPY torontoCensusVisualizer/ .

RUN npm run build

FROM caddy:2-alpine

COPY --from=builder /app/dist /srv/frontend