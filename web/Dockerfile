# Frontend (Vite dev server) for the local development environment.
FROM node:24-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json ./
RUN npm install

# Copy the rest of the source.
COPY . .

# Vite dev server port (overridable via WEB_PORT env at runtime).
EXPOSE 5173

CMD ["npm", "run", "dev"]
