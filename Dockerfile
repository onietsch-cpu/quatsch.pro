FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY . .

RUN npm install
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001

CMD ["npm", "run", "start"]
