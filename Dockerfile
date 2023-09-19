# Builder image
FROM node:16.15.1-alpine3.16 AS builder
# Change the working directory to /app
WORKDIR /app
# Copy files required to build the application
COPY package*.json tsconfig.* ./
RUN npm install --force
# Copy the sources
COPY src ./src/
# Copy the static-data folder
COPY static-data ./static-data/

# Build the application (leaves result on ./dist)
RUN npm run build
# Execute `npm ci` (not install) for production with an externally mounted npmrc
RUN npm ci --omit=dev --ignore-scripts --force

# Production image
FROM node:16.15.1-alpine3.16 AS service
# Set the NODE_ENV value from the args
ARG NODE_ENV=production
# Export the NODE_ENV to the container environment
ENV NODE_ENV=${NODE_ENV}
# For security reasons don't run as root
USER node
# Change the working directory to /app
WORKDIR /app
# Copy files required to run the application
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
# Copy the dist folder from the builder
COPY --chown=node:node --from=builder /app/dist ./dist
# Copy the public folder from the repository
COPY --chown=node:node public/ ./public/
# Copy the static-data folder from the repository
COPY --chown=node:node static-data/ ./static-data/
# Copy the sources ... FIXME(sto): this should not be needed!!!
COPY --chown=node:node src/ ./src/
# Create link to the sources from dist ... FIXME(sto): again, this is wrong
RUN ln -s ../src ./dist/
# Container command
CMD ["node", "/app/dist/main"]
