FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:viewport && npm prune --omit=dev
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app /app
ENV HOST=0.0.0.0 PORT=3000 DIAGRAM_DESK_HOME=/tmp/diagram-desk/registry
USER node
EXPOSE 3000
CMD ["sh", "bin/review-start.sh"]
