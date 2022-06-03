FROM node:alpine

WORKDIR /etc/newman

RUN apk update && apk add bash coreutils curl \ 
&& npm install -g newman newman-reporter-htmlextra

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD [""]