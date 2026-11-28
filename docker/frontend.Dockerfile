FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_ESCENARIO="Campus UPChiapas"
ARG VITE_INSTITUCION=UPChiapas
ENV VITE_ESCENARIO=$VITE_ESCENARIO VITE_INSTITUCION=$VITE_INSTITUCION
RUN npm run build
FROM nginx:stable-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
