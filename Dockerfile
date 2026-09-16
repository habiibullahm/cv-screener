FROM node:20-slim

ENV TZ=Asia/Jakarta \
    NODE_ENV=production

WORKDIR /app

# Dependencies dulu supaya layer ter-cache
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src

CMD ["npm", "start"]
