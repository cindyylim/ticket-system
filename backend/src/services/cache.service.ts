import { redisService } from './redis.service';

class CacheService {
    private readonly DEFAULT_TTL = 3600; // 1 hour default TTL

    // Generic cache get with JSON parsing
    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await redisService.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Cache get error for key ${key}:`, error);
            return null;
        }
    }

    // Generic cache set with JSON stringification
    async set<T>(key: string, value: T, ttlSeconds: number = this.DEFAULT_TTL): Promise<void> {
        try {
            await redisService.set(key, JSON.stringify(value), ttlSeconds);
        } catch (error) {
            console.error(`Cache set error for key ${key}:`, error);
        }
    }

    // Delete single cache entry
    async delete(key: string): Promise<void> {
        try {
            await redisService.del(key);
        } catch (error) {
            console.error(`Cache delete error for key ${key}:`, error);
        }
    }

    // Delete multiple cache entries by pattern
    async deletePattern(pattern: string): Promise<void> {
        try {
            await redisService.delPattern(pattern);
        } catch (error) {
            console.error(`Cache delete pattern error for ${pattern}:`, error);
        }
    }

    // Cache keys for different entities
    eventKey(eventId: string): string {
        return `event:${eventId}`;
    }

    eventsListKey(page: number = 1, category?: string): string {
        return category ? `events:list:${category}:${page}` : `events:list:${page}`;
    }

    venueKey(venueId: string): string {
        return `venue:${venueId}`;
    }

    performerKey(performerId: string): string {
        return `performer:${performerId}`;
    }

    eventSeatsKey(eventId: string): string {
        return `event:${eventId}:seats`;
    }

    // Invalidate event-related caches
    async invalidateEvent(eventId: string): Promise<void> {
        await this.delete(this.eventKey(eventId));
        await this.delete(this.eventSeatsKey(eventId));
        await this.deletePattern('events:list:*'); // Invalidate all event lists
    }

    // Invalidate venue-related caches
    async invalidateVenue(venueId: string): Promise<void> {
        await this.delete(this.venueKey(venueId));
        await this.deletePattern('events:list:*'); // Events may reference this venue
    }

    // Invalidate performer-related caches
    async invalidatePerformer(performerId: string): Promise<void> {
        await this.delete(this.performerKey(performerId));
        await this.deletePattern('events:list:*'); // Events may reference this performer
    }
}

export const cacheService = new CacheService();
