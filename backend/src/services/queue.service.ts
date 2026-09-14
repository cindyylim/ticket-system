import { redisService } from './redis.service';

class QueueService {
    private readonly MAX_CONCURRENT_PROCESSING = 10; // Process 10 bookings at a time per event
    private readonly PROCESSING_INTERVAL = 2000; // Used for wait estimates; BullMQ ticks at this interval
    private readonly PROCESSING_LOCK_TTL = 5; // Lock TTL in seconds
    private readonly ACTIVE_TTL_MS = 90_000; // Admission slot expires if the user never locks

    private getQueueKey(eventId: string): string {
        return `queue:${eventId}`;
    }

    private getActiveKey(eventId: string): string {
        return `active:${eventId}`;
    }

    private getProcessingLockKey(eventId: string): string {
        return `processing:${eventId}`;
    }

    private getMemberKey(eventId: string, userId: string): string {
        return `queue:member:${eventId}:${userId}`;
    }

    private getTrackedEventsKey(): string {
        return 'queue:tracked';
    }

    private serializeEntry(userId: string, requestId: string): string {
        return `${userId}:${requestId}`;
    }

    private deserializeEntry(member: string): { userId: string; requestId: string } {
        const separator = member.indexOf(':');
        if (separator === -1) {
            return { userId: member, requestId: '' };
        }
        return { userId: member.slice(0, separator), requestId: member.slice(separator + 1) };
    }

    private async pruneExpiredActive(eventId: string): Promise<void> {
        await redisService.zremrangebyscore(this.getActiveKey(eventId), 0, Date.now());
    }

    async joinQueue(eventId: string, userId: string, requestId: string): Promise<number> {
        await this.pruneExpiredActive(eventId);

        if (await this.canProceed(eventId, userId)) {
            return 0;
        }

        const queueKey = this.getQueueKey(eventId);
        const memberKey = this.getMemberKey(eventId, userId);
        const existingMember = await redisService.get(memberKey);
        if (existingMember) {
            const existingRank = await redisService.zrank(queueKey, existingMember);
            return existingRank !== null ? existingRank + 1 : 1;
        }

        const activeCount = await redisService.zcard(this.getActiveKey(eventId));
        const waiting = await redisService.zcard(queueKey);

        // Under capacity and nobody waiting: skip the waiting room.
        if (activeCount < this.MAX_CONCURRENT_PROCESSING && waiting === 0) {
            await redisService.zadd(
                this.getActiveKey(eventId),
                Date.now() + this.ACTIVE_TTL_MS,
                userId
            );
            return 0;
        }

        const member = this.serializeEntry(userId, requestId);
        await redisService.zadd(queueKey, Date.now(), member);
        await redisService.set(memberKey, member);
        await redisService.sadd(this.getTrackedEventsKey(), eventId);

        const rank = await redisService.zrank(queueKey, member);
        const position = rank !== null ? rank + 1 : 1;

        console.log(`📋 User ${userId} joined queue for event ${eventId} at position ${position}`);

        return position;
    }

    async getPosition(eventId: string, userId: string): Promise<number | null> {
        if (await this.canProceed(eventId, userId)) {
            return 0;
        }

        const member = await redisService.get(this.getMemberKey(eventId, userId));
        if (!member) {
            return null;
        }

        const rank = await redisService.zrank(this.getQueueKey(eventId), member);
        return rank !== null ? rank + 1 : null;
    }

    async removeFromQueue(eventId: string, userId: string): Promise<void> {
        const queueKey = this.getQueueKey(eventId);
        const activeKey = this.getActiveKey(eventId);
        const memberKey = this.getMemberKey(eventId, userId);

        await redisService.zrem(activeKey, userId);

        const member = await redisService.get(memberKey);
        if (member) {
            await redisService.zrem(queueKey, member);
            await redisService.del(memberKey);
            console.log(`📋 User ${userId} removed from queue for event ${eventId}`);
        }

        const queueLength = await redisService.zcard(queueKey);
        const activeCount = await redisService.zcard(activeKey);

        if (queueLength === 0 && activeCount === 0) {
            await redisService.srem(this.getTrackedEventsKey(), eventId);
        }
    }

    async canProceed(eventId: string, userId: string): Promise<boolean> {
        await this.pruneExpiredActive(eventId);
        const score = await redisService.zscore(this.getActiveKey(eventId), userId);
        return score !== null;
    }

    async getQueueStats(eventId: string): Promise<{ length: number; estimatedWaitTime: number }> {
        const queueKey = this.getQueueKey(eventId);
        const length = await redisService.zcard(queueKey);

        const batchesAhead = Math.ceil(length / this.MAX_CONCURRENT_PROCESSING);
        const estimatedWaitTime = batchesAhead * this.PROCESSING_INTERVAL;

        return { length, estimatedWaitTime };
    }

    async processPendingQueues(): Promise<void> {
        const eventIds = await redisService.smembers(this.getTrackedEventsKey());
        for (const eventId of eventIds) {
            await this.processQueue(eventId);
        }
    }

    private async processQueue(eventId: string): Promise<void> {
        const lockKey = this.getProcessingLockKey(eventId);
        const queueKey = this.getQueueKey(eventId);
        const activeKey = this.getActiveKey(eventId);

        const lockAcquired = await redisService.setnx(
            lockKey,
            'locked',
            this.PROCESSING_LOCK_TTL
        );

        if (!lockAcquired) {
            return;
        }

        try {
            await this.pruneExpiredActive(eventId);

            const queueLength = await redisService.zcard(queueKey);
            const activeCount = await redisService.zcard(activeKey);
            const slots = this.MAX_CONCURRENT_PROCESSING - activeCount;

            if (queueLength === 0) {
                if (activeCount === 0) {
                    await redisService.srem(this.getTrackedEventsKey(), eventId);
                }
                return;
            }

            if (slots <= 0) {
                return;
            }

            const batchSize = Math.min(slots, queueLength);
            const batch = await redisService.zpopmin(queueKey, batchSize);
            const members = batch.filter((_, index) => index % 2 === 0);

            const expiresAt = Date.now() + this.ACTIVE_TTL_MS;
            for (const member of members) {
                const { userId } = this.deserializeEntry(member);
                await redisService.zadd(activeKey, expiresAt, userId);
                await redisService.del(this.getMemberKey(eventId, userId));
                console.log(`✅ User ${userId} moved to active state for event ${eventId}`);
            }

            if (members.length > 0) {
                const remainingInQueue = await redisService.zcard(queueKey);
                console.log(`📋 Processed batch of ${members.length} users. Remaining in queue: ${remainingInQueue}`);
            }
        } finally {
            await redisService.del(lockKey);
        }
    }
}

export const queueService = new QueueService();
