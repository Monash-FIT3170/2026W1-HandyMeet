FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY agent/ ./agent/
COPY tsconfig.json ./
CMD ["node_modules/.bin/tsx", "agent/transcription.ts", "start"]
