import Redis from 'ioredis';
import dotenv from "dotenv";

dotenv.config();
class RedisService {
    private client: Redis;
    private subscriberClient: Redis;
    private isConnected: boolean = false;

    constructor() {
        const redisUri = process.env.REDIS_URI;
        if (!redisUri) {
            throw new Error("REDIS_URI is not defined")
        }

        const redisOptions = {
            retryStrategy: (times: number) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
        };

        this.client = new Redis(redisUri, redisOptions);
        this.subscriberClient = new Redis(redisUri, redisOptions);

        this.client.on('connect', () => {
            console.log('✅ Redis connected');
            this.isConnected = true;
        });

        this.client.on('error', (err) => {
            console.error('❌ Redis error:', err);
            this.isConnected = false;
        });

        this.subscriberClient.on('connect', () => {
            console.log('✅ Redis subscriber connected');
        });

        this.subscriberClient.on('error', (err) => {
            console.error('❌ Redis subscriber error:', err);
        });
    }

    getClient(): Redis {
        return this.client;
    }

    isReady(): boolean {
        return this.isConnected;
    }

    async get(key: string): Promise<string | null> {
        return await this.client.get(key);
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds) {
            await this.client.setex(key, ttlSeconds, value);
        } else {
            await this.client.set(key, value);
        }
    }

    async setnx(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
        if (ttlSeconds) {
            const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
            return result === 'OK';
        } else {
            const result = await this.client.setnx(key, value);
            return result === 1;
        }
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    async exists(key: string): Promise<boolean> {
        const result = await this.client.exists(key);
        return result === 1;
    }

    // Pattern-based deletion (e.g., delete all keys matching "event:*")
    async delPattern(pattern: string): Promise<void> {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(...keys);
        }
    }

    async disconnect(): Promise<void> {
        await this.client.quit();
    }

    // Sorted Set operations for queue management
    async zadd(key: string, score: number, member: string): Promise<number> {
        return await this.client.zadd(key, score, member);
    }

    async zrank(key: string, member: string): Promise<number | null> {
        return await this.client.zrank(key, member);
    }

    async zrem(key: string, ...members: string[]): Promise<number> {
        return await this.client.zrem(key, ...members);
    }

    async zcard(key: string): Promise<number> {
        return await this.client.zcard(key);
    }

    async zpopmin(key: string, count: number): Promise<string[]> {
        return await this.client.zpopmin(key, count);
    }

    async zrange(key: string, start: number, stop: number): Promise<string[]> {
        return await this.client.zrange(key, start, stop);
    }

    // Set operations for active users management
    async sadd(key: string, ...members: string[]): Promise<number> {
        return await this.client.sadd(key, ...members);
    }

    async srem(key: string, ...members: string[]): Promise<number> {
        return await this.client.srem(key, ...members);
    }

    async sismember(key: string, member: string): Promise<boolean> {
        const result = await this.client.sismember(key, member);
        return result === 1;
    }

    async scard(key: string): Promise<number> {
        return await this.client.scard(key);
    }

    async smembers(key: string): Promise<string[]> {
        return await this.client.smembers(key);
    }

    // Pub/Sub operations
    async publish(channel: string, message: string): Promise<number> {
        return await this.client.publish(channel, message);
    }

    async psubscribe(pattern: string, callback: (channel: string, message: string) => void): Promise<void> {
        await this.subscriberClient.psubscribe(pattern);
        this.subscriberClient.on('pmessage', (patternMatch, channel, message) => {
            if (patternMatch === pattern) {
                callback(channel, message);
            }
        });
    }

    async subscribe(channel: string, callback: (channel: string, message: string) => void): Promise<void> {
        await this.subscriberClient.subscribe(channel);
        this.subscriberClient.on('message', (chan, message) => {
            if (chan === channel) {
                callback(chan, message);
            }
        });
    }
}

export const redisService = new RedisService();
