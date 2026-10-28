
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci


FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/www /usr/share/nginx/html

EXPOSE 80
