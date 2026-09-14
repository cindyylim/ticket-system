import { queueService } from '../../services/queue.service';
import { redisService } from '../../services/redis.service';

jest.mock('../../services/redis.service');

describe('QueueService', () => {
    const eventId = 'event-123';
    const userId = 'user-456';
    const requestId = 'req-789';

    beforeEach(() => {
        jest.clearAllMocks();
        (redisService.zremrangebyscore as jest.Mock).mockResolvedValue(0);
        (redisService.zscore as jest.Mock).mockResolvedValue(null);
        (redisService.get as jest.Mock).mockResolvedValue(null);
        (redisService.zcard as jest.Mock).mockResolvedValue(0);
        (redisService.zrank as jest.Mock).mockResolvedValue(0);
        (redisService.smembers as jest.Mock).mockResolvedValue([]);
        (redisService.sadd as jest.Mock).mockResolvedValue(1);
        (redisService.srem as jest.Mock).mockResolvedValue(1);
    });

    describe('joinQueue', () => {
        it('should admit immediately when under capacity and the waiting room is empty', async () => {
            (redisService.zcard as jest.Mock).mockResolvedValue(0);

            const position = await queueService.joinQueue(eventId, userId, requestId);

            expect(position).toBe(0);
            expect(redisService.zadd).toHaveBeenCalledWith(
                `active:${eventId}`,
                expect.any(Number),
                userId
            );
            expect(redisService.zadd).not.toHaveBeenCalledWith(
                `queue:${eventId}`,
                expect.any(Number),
                expect.any(String)
            );
        });

        it('should enqueue when at capacity', async () => {
            (redisService.zcard as jest.Mock).mockImplementation(async (key: string) => {
                return key.startsWith('active:') ? 10 : 0;
            });
            (redisService.zrank as jest.Mock).mockResolvedValue(0);

            const position = await queueService.joinQueue(eventId, userId, requestId);

            expect(position).toBe(1);
            expect(redisService.zadd).toHaveBeenCalledWith(
                `queue:${eventId}`,
                expect.any(Number),
                `${userId}:${requestId}`
            );
            expect(redisService.sadd).toHaveBeenCalledWith('queue:tracked', eventId);
        });

        it('should enqueue behind existing waiters even if active count is below cap', async () => {
            (redisService.zcard as jest.Mock).mockImplementation(async (key: string) => {
                return key.startsWith('active:') ? 2 : 4;
            });
            (redisService.zrank as jest.Mock).mockResolvedValue(4);

            const position = await queueService.joinQueue(eventId, userId, requestId);

            expect(position).toBe(5);
            expect(redisService.zadd).toHaveBeenCalledWith(
                `queue:${eventId}`,
                expect.any(Number),
                `${userId}:${requestId}`
            );
        });

        it('should return existing position instead of double-enqueueing', async () => {
            (redisService.get as jest.Mock).mockResolvedValue(`${userId}:${requestId}`);
            (redisService.zrank as jest.Mock).mockResolvedValue(2);

            const position = await queueService.joinQueue(eventId, userId, requestId);

            expect(position).toBe(3);
            expect(redisService.zadd).not.toHaveBeenCalled();
        });

        it('should return 0 if already active', async () => {
            (redisService.zscore as jest.Mock).mockResolvedValue(Date.now() + 60_000);

            const position = await queueService.joinQueue(eventId, userId, requestId);

            expect(position).toBe(0);
            expect(redisService.zadd).not.toHaveBeenCalled();
        });
    });

    describe('getPosition', () => {
        it('should return 0 if active', async () => {
            (redisService.zscore as jest.Mock).mockResolvedValue(Date.now() + 60_000);

            const position = await queueService.getPosition(eventId, userId);

            expect(position).toBe(0);
        });

        it('should return position from sorted-set rank', async () => {
            (redisService.get as jest.Mock).mockResolvedValue(`${userId}:${requestId}`);
            (redisService.zrank as jest.Mock).mockResolvedValue(1);

            const position = await queueService.getPosition(eventId, userId);

            expect(position).toBe(2);
            expect(redisService.zrank).toHaveBeenCalledWith(`queue:${eventId}`, `${userId}:${requestId}`);
        });

        it('should return null if not in queue', async () => {
            (redisService.get as jest.Mock).mockResolvedValue(null);

            const position = await queueService.getPosition(eventId, userId);

            expect(position).toBeNull();
        });
    });

    describe('getQueueStats', () => {
        it('should return queue stats', async () => {
            (redisService.zcard as jest.Mock).mockResolvedValue(25);

            const stats = await queueService.getQueueStats(eventId);

            expect(stats.length).toBe(25);
            expect(stats.estimatedWaitTime).toBe(6000);
        });
    });

    describe('removeFromQueue', () => {
        it('should remove user from queue and active set', async () => {
            (redisService.zrem as jest.Mock).mockResolvedValue(1);
            (redisService.get as jest.Mock).mockResolvedValue(`${userId}:${requestId}`);
            (redisService.zcard as jest.Mock).mockResolvedValue(0);

            await queueService.removeFromQueue(eventId, userId);

            expect(redisService.zrem).toHaveBeenCalledWith(`active:${eventId}`, userId);
            expect(redisService.zrem).toHaveBeenCalledWith(`queue:${eventId}`, `${userId}:${requestId}`);
            expect(redisService.del).toHaveBeenCalledWith(`queue:member:${eventId}:${userId}`);
        });
    });

    describe('processQueue', () => {
        it('should admit only remaining slots under the cap', async () => {
            const serviceAny = queueService as any;

            (redisService.setnx as jest.Mock).mockResolvedValue(true);
            (redisService.zcard as jest.Mock).mockImplementation(async (key: string) => {
                if (key.startsWith('active:')) return 8;
                return 5;
            });
            (redisService.zpopmin as jest.Mock).mockResolvedValue([
                `${userId}:${requestId}`, '123456'
            ]);
            (redisService.zadd as jest.Mock).mockResolvedValue(1);
            (redisService.del as jest.Mock).mockResolvedValue(1);

            await serviceAny.processQueue(eventId);

            expect(redisService.setnx).toHaveBeenCalledWith(`processing:${eventId}`, 'locked', 5);
            expect(redisService.zpopmin).toHaveBeenCalledWith(`queue:${eventId}`, 2);
            expect(redisService.zadd).toHaveBeenCalledWith(
                `active:${eventId}`,
                expect.any(Number),
                userId
            );
            expect(redisService.del).toHaveBeenCalledWith(`processing:${eventId}`);
        });

        it('should not pop waiters when the active set is full', async () => {
            const serviceAny = queueService as any;

            (redisService.setnx as jest.Mock).mockResolvedValue(true);
            (redisService.zcard as jest.Mock).mockImplementation(async (key: string) => {
                if (key.startsWith('active:')) return 10;
                return 4;
            });
            (redisService.del as jest.Mock).mockResolvedValue(1);

            await serviceAny.processQueue(eventId);

            expect(redisService.zpopmin).not.toHaveBeenCalled();
        });

        it('should not process if lock held', async () => {
            const serviceAny = queueService as any;
            (redisService.setnx as jest.Mock).mockResolvedValue(false);

            await serviceAny.processQueue(eventId);

            expect(redisService.zpopmin).not.toHaveBeenCalled();
        });

        it('should process every tracked event', async () => {
            const serviceAny = queueService as any;
            const processSpy = jest.spyOn(serviceAny, 'processQueue').mockResolvedValue(undefined);
            (redisService.smembers as jest.Mock).mockResolvedValue(['event-a', 'event-b']);

            await queueService.processPendingQueues();

            expect(processSpy).toHaveBeenCalledWith('event-a');
            expect(processSpy).toHaveBeenCalledWith('event-b');
            processSpy.mockRestore();
        });
    });
});
