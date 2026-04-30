FROM node:20-alpine

ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
WORKDIR /app

COPY package.json tsconfig.json next.config.mjs next-env.d.ts ./
COPY src ./src

RUN npm install --no-audit --no-fund
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
