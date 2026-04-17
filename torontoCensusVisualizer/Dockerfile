FROM node:22-alpine

WORKDIR /app

COPY torontoCensusVisualizer/package*.json ./
RUN npm install

COPY torontoCensusVisualizer/ .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]