# Global Dockerfile Arguments (in our CI can be overriden in ./.build-args)
ARG BUILDER_IMG=registry.kyso.io/kyso-io/kyso-api
ARG BUILDER_TAG=builder
ARG SERVICE_IMG=registry.kyso.io/docker/node
ARG SERVICE_TAG=latest

# Builder image
FROM ${BUILDER_IMG}:${BUILDER_TAG} AS builder
# For security reasons don't run as root
USER node
# Change the working directory to /app
WORKDIR /app
# Copy files required to build the application
COPY --chown=node:node package*.json tsconfig.* ./
# Execute `npm ci` (not install) with an externally mounted npmrc
RUN --mount=type=secret,id=npmrc,target=/app/.npmrc,uid=1000,required npm ci
# Copy the sources
COPY --chown=node:node src ./src/
# Build the application (leaves result on ./dist)
RUN npm run build
# Execute `npm ci` (not install) for production with an externally mounted npmrc
RUN --mount=type=secret,id=npmrc,target=/app/.npmrc,uid=1000,required\
 npm ci --only=production

# Production image
FROM ${SERVICE_IMG}:${SERVICE_TAG} AS service
# Set the NODE_ENV value from the args
ARG NODE_ENV=production
# Export the NODE_ENV to the container environment
ENV NODE_ENV=${NODE_ENV}
# For security reasons don't run as root
USER node
# Change the working directory to /app
WORKDIR /app
# Copy the dist folder from the builder
COPY --chown=node:node --from=builder /app/dist ./dist
# Copy the sources ... FIXME(sto): this should not be needed!!!
COPY --chown=node:node src/ ./src/
# Create link to the sources from dist ... FIXME(sto): again, this is wrong
RUN ln -s ../src ./dist/
# Container command
CMD ["node", "/app/dist/main"]
