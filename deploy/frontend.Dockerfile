FROM node:22-alpine AS build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_API_RUN_PATH=/api/v1/query
ARG VITE_API_PREVIEW_PATH=/api/v1/planner/intent

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_API_RUN_PATH=${VITE_API_RUN_PATH} \
    VITE_API_PREVIEW_PATH=${VITE_API_PREVIEW_PATH}

RUN npm run build


FROM nginx:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
