import { queueService } from '../../services/queue.service';
import { redisService } from '../../services/redis.service';

jest.mock('../../services/redis.service');

describe('QueueService', () => {
    const eventId = 'event-123';
    const userId = 'user-456';
    const requestId = 'req-789';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
    });

    describe('joinQueue', () => {
        it('should join queue successfully', async () => {
            (redisService.sismember as jest.Mock).mockResolvedValue(false); // not active
            (redisService.zadd as jest.Mock).mockResolvedValue(1);
            (redisService.zrank as jest.Mock).mockResolvedValue(4); // 0-indexed rank 4 -> position 5

            const position = await queueService.joinQueue(eventId, userId, requestId);

            expect(redisService.zadd).toHaveBeenCalledWith(
                `queue:${eventId}`,
                expect.any(Number),
                `${userId}:${requestId}`
            );
            expect(position).toBe(5);
        });

        it('should return 0 if already active', async () => {
            (redisService.sismember as jest.Mock).mockResolvedValue(true);

            const position = await queueService.joinQueue(eventId, userId, requestId);

            expect(position).toBe(0);
            expect(redisService.zadd).not.toHaveBeenCalled();
        });
    });

    describe('getPosition', () => {
        it('should return 0 if active', async () => {
            (redisService.sismember as jest.Mock).mockResolvedValue(true);

            const position = await queueService.getPosition(eventId, userId);

            expect(position).toBe(0);
        });

        it('should return position if in queue', async () => {
            (redisService.sismember as jest.Mock).mockResolvedValue(false);
            (redisService.zrange as jest.Mock).mockResolvedValue([
                'other:req1',
                `${userId}:${requestId}`,
                'another:req2'
            ]);

            const position = await queueService.getPosition(eventId, userId);

            expect(position).toBe(2);
        });

        it('should return null if not in queue', async () => {
            (redisService.sismember as jest.Mock).mockResolvedValue(false);
            (redisService.zrange as jest.Mock).mockResolvedValue(['other:req1']);

            const position = await queueService.getPosition(eventId, userId);

            expect(position).toBeNull();
        });
    });

    describe('getQueueStats', () => {
        it('should return queue stats', async () => {
            (redisService.zcard as jest.Mock).mockResolvedValue(25);

            const stats = await queueService.getQueueStats(eventId);

            // 10 concurrent, 25 in queue -> 3 batches. 3 * 2000ms = 6000ms
            expect(stats.length).toBe(25);
            expect(stats.estimatedWaitTime).toBe(6000);
        });
    });

    describe('removeFromQueue', () => {
        it('should remove user from queue and active set', async () => {
            (redisService.srem as jest.Mock).mockResolvedValue(1);
            (redisService.zrange as jest.Mock).mockResolvedValue([`${userId}:${requestId}`]);
            (redisService.zrem as jest.Mock).mockResolvedValue(1);
            (redisService.zcard as jest.Mock).mockResolvedValue(0);
            (redisService.scard as jest.Mock).mockResolvedValue(0);

            await queueService.removeFromQueue(eventId, userId);

            expect(redisService.srem).toHaveBeenCalledWith(`active:${eventId}`, userId);
            expect(redisService.zrem).toHaveBeenCalledWith(`queue:${eventId}`, `${userId}:${requestId}`);
        });
    });

    describe('processQueue', () => {
        it('should process queue batch', async () => {
            const serviceAny = queueService as any;

            (redisService.setnx as jest.Mock).mockResolvedValue(true);
            (redisService.zcard as jest.Mock).mockResolvedValue(5);
            (redisService.scard as jest.Mock).mockResolvedValue(0);
            (redisService.zpopmin as jest.Mock).mockResolvedValue([
                `${userId}:${requestId}`, '123456'
            ]);
            (redisService.sadd as jest.Mock).mockResolvedValue(1);
            (redisService.del as jest.Mock).mockResolvedValue(1);

            await serviceAny.processQueue(eventId);

            expect(redisService.setnx).toHaveBeenCalledWith(`processing:${eventId}`, 'locked', 5);
            expect(redisService.zpopmin).toHaveBeenCalledWith(`queue:${eventId}`, expect.any(Number));
            expect(redisService.sadd).toHaveBeenCalledWith(`active:${eventId}`, userId);
            expect(redisService.del).toHaveBeenCalledWith(`processing:${eventId}`);
        });

        it('should not process if lock held', async () => {
            const serviceAny = queueService as any;
            (redisService.setnx as jest.Mock).mockResolvedValue(false);

            await serviceAny.processQueue(eventId);

            expect(redisService.zpopmin).not.toHaveBeenCalled();
        });
    });
});
