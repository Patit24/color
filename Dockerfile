FROM node:22-alpine AS web-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=web-deps /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
