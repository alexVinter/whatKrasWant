# Build React application
FROM node:24-alpine AS build

WORKDIR /app

# Public frontend env only — never pass VK secrets into the web build stage.
ARG VITE_VK_CLIENT_ID
ARG VITE_VK_REDIRECT_URI
ENV VITE_VK_CLIENT_ID=$VITE_VK_CLIENT_ID
ENV VITE_VK_REDIRECT_URI=$VITE_VK_REDIRECT_URI

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build


# Production static server
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
