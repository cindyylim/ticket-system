import { lockService } from '../../services/lock.service';
import { redisService } from '../../services/redis.service';

// Mock redisService
jest.mock('../../services/redis.service', () => ({
    redisService: {
        getClient: jest.fn(() => ({
            set: jest.fn(),
            eval: jest.fn()
        })),
        exists: jest.fn(),
        get: jest.fn()
    }
}));

describe('LockService', () => {
    let mockRedisClient: any;

    beforeEach(() => {
        mockRedisClient = {
            set: jest.fn(),
            eval: jest.fn()
        };
        (redisService.getClient as jest.Mock).mockReturnValue(mockRedisClient);
        jest.clearAllMocks();
    });

    describe('acquireLock', () => {
        it('should successfully acquire a lock', async () => {
            mockRedisClient.set.mockResolvedValue('OK');

            const result = await lockService.acquireLock('seat:123', 'user-456');

            expect(result.acquired).toBe(true);
            expect(result.lockId).toBeDefined();
            expect(mockRedisClient.set).toHaveBeenCalledWith(
                'lock:seat:123',
                expect.any(String),
                'EX',
                expect.any(Number),
                'NX'
            );
        });

        it('should fail to acquire lock if already held', async () => {
            mockRedisClient.set.mockResolvedValue(null);

            const result = await lockService.acquireLock('seat:123', 'user-456');

            expect(result.acquired).toBe(false);
            expect(result.lockId).toBeUndefined();
        });

        it('should handle errors gracefully', async () => {
            mockRedisClient.set.mockRejectedValue(new Error('Redis error'));

            const result = await lockService.acquireLock('seat:123', 'user-456');

            expect(result.acquired).toBe(false);
        });
    });

    describe('releaseLock', () => {
        it('should successfully release a lock with matching lockId', async () => {
            mockRedisClient.eval.mockResolvedValue(1);

            const result = await lockService.releaseLock('seat:123', 'lock-id-123');

            expect(result).toBe(true);
            expect(mockRedisClient.eval).toHaveBeenCalledWith(
                expect.any(String),
                1,
                'lock:seat:123',
                'lock-id-123'
            );
        });

        it('should fail to release lock with mismatched lockId', async () => {
            mockRedisClient.eval.mockResolvedValue(0);

            const result = await lockService.releaseLock('seat:123', 'wrong-lock-id');

            expect(result).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            mockRedisClient.eval.mockRejectedValue(new Error('Redis error'));

            const result = await lockService.releaseLock('seat:123', 'lock-id-123');

            expect(result).toBe(false);
        });
    });

    describe('isLocked', () => {
        it('should return true if resource is locked', async () => {
            (redisService.exists as jest.Mock).mockResolvedValue(true);

            const result = await lockService.isLocked('seat:123');

            expect(result).toBe(true);
            expect(redisService.exists).toHaveBeenCalledWith('lock:seat:123');
        });

        it('should return false if resource is not locked', async () => {
            (redisService.exists as jest.Mock).mockResolvedValue(false);

            const result = await lockService.isLocked('seat:123');

            expect(result).toBe(false);
        });
    });

    describe('getLockInfo', () => {
        it('should return lock info if lock exists', async () => {
            const lockData = { userId: 'user-123', lockId: 'lock-456', acquiredAt: Date.now() };
            (redisService.get as jest.Mock).mockResolvedValue(JSON.stringify(lockData));

            const result = await lockService.getLockInfo('seat:123');

            expect(result).toEqual(lockData);
            expect(redisService.get).toHaveBeenCalledWith('lock:seat:123');
        });

        it('should return null if lock does not exist', async () => {
            (redisService.get as jest.Mock).mockResolvedValue(null);

            const result = await lockService.getLockInfo('seat:123');

            expect(result).toBeNull();
        });

        it('should return null if lock data is invalid JSON', async () => {
            (redisService.get as jest.Mock).mockResolvedValue('invalid-json');

            const result = await lockService.getLockInfo('seat:123');

            expect(result).toBeNull();
        });
    });

    describe('getLockTTL', () => {
        it('should return the lock TTL', () => {
            const ttl = lockService.getLockTTL();

            expect(ttl).toBeGreaterThan(0);
            expect(typeof ttl).toBe('number');
        });
    });
});
