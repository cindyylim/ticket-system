import Redis from 'ioredis';
import dotenv from "dotenv";

dotenv.config();
class RedisService {
    private client: Redis;
    private isConnected: boolean = false;

    constructor() {
        const redisUri = process.env.REDIS_URI;
        if (!redisUri) {
            throw new Error("REDIS_URI is not defined")
        }
        this.client = new Redis(redisUri, {
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
        });

        this.client.on('connect', () => {
            console.log('✅ Redis connected');
            this.isConnected = true;
        });

        this.client.on('error', (err) => {
            console.error('❌ Redis error:', err);
            this.isConnected = false;
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
}

export const redisService = new RedisService();
