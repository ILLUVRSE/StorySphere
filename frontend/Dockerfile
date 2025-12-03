# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package.json & install first for better caching
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

# Copy the rest of the frontend
COPY . .

# Expose Next default dev port
EXPOSE 3000

# Use the dev command so docker-compose can run the dev server
CMD ["npm", "run", "dev"]
