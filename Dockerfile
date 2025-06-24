
# Build Stage
FROM node:22 as build

WORKDIR /app

COPY frontend/package*.json ./

RUN npm install 

COPY frontend ./

CMD ["npm", "run", "build"]

# Production Stage
FROM nginx:alpine as prod

COPY --from=build /app/dist /var/www/html

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
