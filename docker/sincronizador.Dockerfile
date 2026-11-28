FROM node:26-bookworm-slim
WORKDIR /app/sincronizador
COPY sincronizador/package*.json ./
RUN npm ci
COPY sincronizador/ ./
COPY bases-de-datos/ /app/bases-de-datos/
COPY docker/inicializar.ts /app/sincronizador/inicializar.ts
USER node
CMD ["node", "--import", "tsx", "src/index.ts"]
