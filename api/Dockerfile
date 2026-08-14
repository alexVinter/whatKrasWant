# Backend (NestJS) for the local development environment.
FROM node:24-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json ./
RUN npm install

# Copy the rest of the source (including prisma/schema.prisma).
COPY . .

# Generate the Prisma client into node_modules so the app can import it at runtime.
RUN npx prisma generate

# API port (overridable via API_PORT env at runtime).
EXPOSE 3000

CMD ["npm", "run", "start:dev"]
