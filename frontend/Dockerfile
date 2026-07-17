# Stage 1: Build the Angular SPA
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve the SPA via Nginx
FROM nginx:1.25-alpine

# Copy built application to Nginx public folder
COPY --from=build /app/dist/adios-frontend/browser /usr/share/nginx/html

# Copy Nginx server configuration template for runtime environment variable substitution
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Default port environment variable for local testing or Cloud Run fallbacks
ENV PORT=8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
