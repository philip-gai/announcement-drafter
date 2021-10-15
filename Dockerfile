FROM node:12-slim
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --production
RUN npm cache clean --force
RUN npm install
ENV NODE_ENV="production"
COPY . .
RUN npm run build
CMD [ "npm", "start" ]
