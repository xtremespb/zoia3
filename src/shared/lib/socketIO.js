import Redis from "ioredis";
import SocketIO from "socket.io";
import redisAdapter from "socket.io-redis";

export default class {
    constructor(fastify) {
        this.io = new SocketIO(fastify.server, fastify.zoiaConfig.socketIO || {});
        if (fastify.zoiaConfig.redis.enabled) {
            this.io.adapter(redisAdapter({
                key: `${fastify.zoiaConfig.siteOptions.id}.socket.io`,
                pubClient: new Redis(fastify.zoiaConfig.redis),
                subClient: new Redis(fastify.zoiaConfig.redis)
            }));
        }
        fastify.decorate("io", this.io);
        fastify.decorateRequest("io", this.io);
        this.io.on("connection", socket => {
            socket.use((packet, next) => {
                fastify.socketIoModules.map(f => f(fastify, packet, socket));
                next();
            });
        });
    }

    setEvents() {
        // TODO: Set event hanlders
    }
}