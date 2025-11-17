# === Stage 1: Build the frontend ===
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
# If you have package-lock.json, this will use it
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Build the production bundle
# If your build script is different, adjust here
RUN npm run build

# === Stage 2: Serve with Nginx ===
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend from builder stage
# If you use CRA and output is 'build', change 'dist' to 'build'
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy a basic nginx config (optional but recommended)
# Uncomment this if you create nginx.conf as shown below
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
