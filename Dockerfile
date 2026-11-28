FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# tsx is needed by the worker and migration scripts at runtime.
RUN --mount=type=secret,id=build_ca,required=false \
    if [ -f /run/secrets/build_ca ]; then \
      NODE_EXTRA_CA_CERTS=/run/secrets/build_ca npm ci --include=dev; \
    else npm ci --include=dev; fi
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S -g 10001 reach && adduser -S -D -u 10001 -G reach reach
COPY --from=build --chown=reach:reach /app/node_modules ./node_modules
COPY --from=build --chown=reach:reach /app/.next ./.next
COPY --from=build --chown=reach:reach /app/src ./src
COPY --from=build --chown=reach:reach /app/scripts ./scripts
COPY --from=build --chown=reach:reach /app/db ./db
COPY --from=build --chown=reach:reach /app/package.json /app/package-lock.json /app/tsconfig.json /app/next.config.ts ./
USER reach
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
