FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache ffmpeg && npm install

COPY . .

EXPOSE 3000
