FROM node:18
WORKDIR /app

COPY ./package*.json .
RUN npm install
WORKDIR /app/db
COPY ./db .

WORKDIR /app/src
COPY ./src .

WORKDIR /app
COPY ./entrypoint.sh ./entrypoint.sh
RUN chmod 777 ./entrypoint.sh
ENTRYPOINT [ "./entrypoint.sh" ]