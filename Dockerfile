FROM node:20-alpine AS build

WORKDIR /app

COPY . .

RUN npm ci
RUN npm run build


FROM node:20-alpine AS runtime

WORKDIR /app

RUN npm install --global serve@14

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY server.js ./

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "server.js"]
