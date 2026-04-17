FROM node:22-alpine AS build-stage
WORKDIR /app
COPY torontoCensusVisualizer/package*.json ./
RUN npm install
COPY torontoCensusVisualizer/ .
RUN npm run build

FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]