FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

ENV NODE_ENV=production
EXPOSE 8000

CMD ["npm", "run", "start"]
