
# Build Stage
FROM node:22 as build

WORKDIR /app

COPY package*.json ./

RUN npm install 
ARG VITE_API_URL
ARG CLIENT_URL
ENV VITE_API_URL=$VITE_API_URL
ENV CLIENT_URL=$CLIENT_URL

COPY . .

CMD ["npm", "run", "build"]

# Production Stage
FROM nginx:alpine as prod

COPY --from=build /app/dist /var/www/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
