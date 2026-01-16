# Use Node.js LTS (Long Term Support) slim image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose the gateway port
EXPOSE 4000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["node", "server.js"]
