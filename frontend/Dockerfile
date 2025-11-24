FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Accept build argument for API URL
ARG VITE_API_BASE=https://pomodoroapp-hyekcsauhufjdgbd.westeurope-01.azurewebsites.net/api
ENV VITE_API_BASE=$VITE_API_BASE

# Debug: Show what API_BASE is being used
RUN echo "Building with VITE_API_BASE=$VITE_API_BASE"

# Build the app with the environment variable
# Force rebuild by invalidating cache with timestamp
RUN echo "Build timestamp: $(date)" && npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]