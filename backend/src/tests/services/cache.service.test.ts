import { cacheService } from '../../services/cache.service';
import { redisService } from '../../services/redis.service';

jest.mock('../../services/redis.service');

describe('CacheService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('get', () => {
        it('should get and parse cached data', async () => {
            const mockData = { id: '123', name: 'Test' };
            (redisService.get as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

            const result = await cacheService.get('test-key');

            expect(result).toEqual(mockData);
            expect(redisService.get).toHaveBeenCalledWith('test-key');
        });

        it('should return null if key does not exist', async () => {
            (redisService.get as jest.Mock).mockResolvedValue(null);

            const result = await cacheService.get('test-key');

            expect(result).toBeNull();
        });

        it('should handle errors gracefully', async () => {
            (redisService.get as jest.Mock).mockRejectedValue(new Error('Redis error'));

            const result = await cacheService.get('test-key');

            expect(result).toBeNull();
        });
    });

    describe('set', () => {
        it('should set cached data with default TTL', async () => {
            const mockData = { id: '123', name: 'Test' };
            (redisService.set as jest.Mock).mockResolvedValue(undefined);

            await cacheService.set('test-key', mockData);

            expect(redisService.set).toHaveBeenCalledWith('test-key', JSON.stringify(mockData), 3600);
        });

        it('should set cached data with custom TTL', async () => {
            const mockData = { id: '123', name: 'Test' };
            (redisService.set as jest.Mock).mockResolvedValue(undefined);

            await cacheService.set('test-key', mockData, 7200);

            expect(redisService.set).toHaveBeenCalledWith('test-key', JSON.stringify(mockData), 7200);
        });

        it('should handle errors gracefully', async () => {
            (redisService.set as jest.Mock).mockRejectedValue(new Error('Redis error'));

            await expect(cacheService.set('test-key', { data: 'test' })).resolves.not.toThrow();
        });
    });

    describe('delete', () => {
        it('should delete a cache entry', async () => {
            (redisService.del as jest.Mock).mockResolvedValue(undefined);

            await cacheService.delete('test-key');

            expect(redisService.del).toHaveBeenCalledWith('test-key');
        });

        it('should handle errors gracefully', async () => {
            (redisService.del as jest.Mock).mockRejectedValue(new Error('Redis error'));

            await expect(cacheService.delete('test-key')).resolves.not.toThrow();
        });
    });

    describe('deletePattern', () => {
        it('should delete cache entries by pattern', async () => {
            (redisService.delPattern as jest.Mock).mockResolvedValue(undefined);

            await cacheService.deletePattern('test:*');

            expect(redisService.delPattern).toHaveBeenCalledWith('test:*');
        });

        it('should handle errors gracefully', async () => {
            (redisService.delPattern as jest.Mock).mockRejectedValue(new Error('Redis error'));

            await expect(cacheService.deletePattern('test:*')).resolves.not.toThrow();
        });
    });

    describe('cache key generators', () => {
        it('should generate event key', () => {
            expect(cacheService.eventKey('123')).toBe('event:123');
        });

        it('should generate events list key', () => {
            expect(cacheService.eventsListKey(1)).toBe('events:list:1');
            expect(cacheService.eventsListKey(2, 'concerts')).toBe('events:list:concerts:2');
        });

        it('should generate venue key', () => {
            expect(cacheService.venueKey('456')).toBe('venue:456');
        });

        it('should generate performer key', () => {
            expect(cacheService.performerKey('789')).toBe('performer:789');
        });

        it('should generate event seats key', () => {
            expect(cacheService.eventSeatsKey('123')).toBe('event:123:seats');
        });
    });

    describe('invalidation methods', () => {
        it('should invalidate event caches', async () => {
            (redisService.del as jest.Mock).mockResolvedValue(undefined);
            (redisService.delPattern as jest.Mock).mockResolvedValue(undefined);

            await cacheService.invalidateEvent('123');

            expect(redisService.del).toHaveBeenCalledWith('event:123');
            expect(redisService.del).toHaveBeenCalledWith('event:123:seats');
            expect(redisService.delPattern).toHaveBeenCalledWith('events:list:*');
        });

        it('should invalidate venue caches', async () => {
            (redisService.del as jest.Mock).mockResolvedValue(undefined);
            (redisService.delPattern as jest.Mock).mockResolvedValue(undefined);

            await cacheService.invalidateVenue('456');

            expect(redisService.del).toHaveBeenCalledWith('venue:456');
            expect(redisService.delPattern).toHaveBeenCalledWith('events:list:*');
        });

        it('should invalidate performer caches', async () => {
            (redisService.del as jest.Mock).mockResolvedValue(undefined);
            (redisService.delPattern as jest.Mock).mockResolvedValue(undefined);

            await cacheService.invalidatePerformer('789');

            expect(redisService.del).toHaveBeenCalledWith('performer:789');
            expect(redisService.delPattern).toHaveBeenCalledWith('events:list:*');
        });
    });
});
