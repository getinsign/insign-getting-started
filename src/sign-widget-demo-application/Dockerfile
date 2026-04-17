FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN node -e "require('./src/pdf-generator').ensureTemplate()"
EXPOSE 3000
CMD ["node", "src/server.js"]
