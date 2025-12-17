import { redisService } from './redis.service';

interface QueueEntry {
    userId: string;
    timestamp: number;
    requestId: string;
}

class QueueService {
    private readonly MAX_CONCURRENT_PROCESSING = 10; // Process 10 bookings at a time per event
    private readonly PROCESSING_INTERVAL = 2000; // Process every 2 seconds
    private readonly PROCESSING_LOCK_TTL = 5; // Lock TTL in seconds
    private processingIntervals: Map<string, NodeJS.Timeout> = new Map();

    // Redis key helpers
    private getQueueKey(eventId: string): string {
        return `queue:${eventId}`;
    }

    private getActiveKey(eventId: string): string {
        return `active:${eventId}`;
    }

    private getProcessingLockKey(eventId: string): string {
        return `processing:${eventId}`;
    }

    // Serialize queue entry to store in sorted set
    private serializeEntry(userId: string, requestId: string): string {
        return `${userId}:${requestId}`;
    }

    // Deserialize queue entry from sorted set
    private deserializeEntry(member: string): { userId: string; requestId: string } {
        const [userId, requestId] = member.split(':');
        return { userId, requestId };
    }

    // Join queue for an event
    async joinQueue(eventId: string, userId: string, requestId: string): Promise<number> {
        // If user is already active, return 0 (meaning pass through)
        if (await this.canProceed(eventId, userId)) {
            return 0;
        }

        const queueKey = this.getQueueKey(eventId);
        const member = this.serializeEntry(userId, requestId);
        const timestamp = Date.now();

        // Add to sorted set with timestamp as score
        await redisService.zadd(queueKey, timestamp, member);

        // Start processing if not already started
        if (!this.processingIntervals.has(eventId)) {
            this.startProcessing(eventId);
        }

        // Get position (1-indexed)
        const rank = await redisService.zrank(queueKey, member);
        const position = rank !== null ? rank + 1 : 1;

        console.log(`📋 User ${userId} joined queue for event ${eventId} at position ${position}`);

        return position;
    }

    // Get user's position in queue
    async getPosition(eventId: string, userId: string): Promise<number | null> {
        // If active, they are not in the "waiting" queue
        if (await this.canProceed(eventId, userId)) {
            return 0;
        }

        const queueKey = this.getQueueKey(eventId);

        // Find any entry for this user (they might have multiple requests)
        const allMembers = await redisService.zrange(queueKey, 0, -1);

        for (let i = 0; i < allMembers.length; i++) {
            const { userId: entryUserId } = this.deserializeEntry(allMembers[i]);
            if (entryUserId === userId) {
                return i + 1; // 1-indexed position
            }
        }

        return null;
    }

    // Remove user from queue (after successful booking or cancellation)
    async removeFromQueue(eventId: string, userId: string): Promise<void> {
        const queueKey = this.getQueueKey(eventId);
        const activeKey = this.getActiveKey(eventId);

        // Remove from active users if present
        await redisService.srem(activeKey, userId);

        // Remove all entries for this user from waiting queue
        const allMembers = await redisService.zrange(queueKey, 0, -1);
        const toRemove = allMembers.filter(member => {
            const { userId: entryUserId } = this.deserializeEntry(member);
            return entryUserId === userId;
        });

        if (toRemove.length > 0) {
            await redisService.zrem(queueKey, ...toRemove);
            console.log(`📋 User ${userId} removed from queue for event ${eventId}`);
        }

        // Clean up if everything is empty
        const queueLength = await redisService.zcard(queueKey);
        const activeCount = await redisService.scard(activeKey);

        if (queueLength === 0 && activeCount === 0) {
            this.stopProcessing(eventId);
            // Keys will auto-expire or can be cleaned up separately
        }
    }

    // Check if user can proceed (is in active set)
    async canProceed(eventId: string, userId: string): Promise<boolean> {
        const activeKey = this.getActiveKey(eventId);
        return await redisService.sismember(activeKey, userId);
    }

    // Get queue stats
    async getQueueStats(eventId: string): Promise<{ length: number; estimatedWaitTime: number }> {
        const queueKey = this.getQueueKey(eventId);
        const length = await redisService.zcard(queueKey);

        // Estimate: each batch processes every PROCESSING_INTERVAL ms
        const batchesAhead = Math.ceil(length / this.MAX_CONCURRENT_PROCESSING);
        const estimatedWaitTime = batchesAhead * this.PROCESSING_INTERVAL;

        return { length, estimatedWaitTime };
    }

    // Start processing queue (allow users to proceed in batches)
    private startProcessing(eventId: string): void {
        if (this.processingIntervals.has(eventId)) return;

        console.log(`🚀 Starting queue processing for event ${eventId}`);

        const interval = setInterval(async () => {
            try {
                await this.processQueue(eventId);
            } catch (error) {
                console.error(`Error processing queue for event ${eventId}:`, error);
            }
        }, this.PROCESSING_INTERVAL);

        this.processingIntervals.set(eventId, interval);
    }

    // Process queue batch with distributed lock
    private async processQueue(eventId: string): Promise<void> {
        const lockKey = this.getProcessingLockKey(eventId);
        const queueKey = this.getQueueKey(eventId);
        const activeKey = this.getActiveKey(eventId);

        // Try to acquire processing lock (distributed lock pattern)
        const lockAcquired = await redisService.setnx(
            lockKey,
            'locked',
            this.PROCESSING_LOCK_TTL
        );

        // If we can't acquire the lock, another server is processing
        if (!lockAcquired) {
            return;
        }

        try {
            const queueLength = await redisService.zcard(queueKey);
            const activeCount = await redisService.scard(activeKey);

            // If queue is empty, check if we should stop processing
            if (queueLength === 0) {
                if (activeCount === 0) {
                    this.stopProcessing(eventId);
                }
                return;
            }

            // Process a batch of users
            const batchSize = Math.min(this.MAX_CONCURRENT_PROCESSING, queueLength);

            if (batchSize > 0) {
                // Atomically pop users from the front of the queue
                const batch = await redisService.zpopmin(queueKey, batchSize);

                // batch is an array like [member1, score1, member2, score2, ...]
                // Extract just the members (every other element starting at index 0)
                const members = batch.filter((_, index) => index % 2 === 0);

                // Add users to active set
                const userIds = members.map(member => {
                    const { userId } = this.deserializeEntry(member);
                    return userId;
                });

                if (userIds.length > 0) {
                    await redisService.sadd(activeKey, ...userIds);

                    userIds.forEach(userId => {
                        console.log(`✅ User ${userId} moved to active state for event ${eventId}`);
                    });

                    const remainingInQueue = await redisService.zcard(queueKey);
                    console.log(`📋 Processed batch of ${userIds.length} users. Remaining in queue: ${remainingInQueue}`);
                }
            }
        } finally {
            // Always release the lock
            await redisService.del(lockKey);
        }
    }

    // Stop processing queue
    private stopProcessing(eventId: string): void {
        const interval = this.processingIntervals.get(eventId);
        if (interval) {
            clearInterval(interval);
            this.processingIntervals.delete(eventId);
            console.log(`🛑 Stopped processing queue for event ${eventId}`);
        }
    }

    // Get all queues (for debugging)
    async getAllQueues(): Promise<Map<string, QueueEntry[]>> {
        // This is more complex with Redis - would need to scan for all queue:* keys
        // For now, return empty map as this is primarily for debugging
        console.warn('getAllQueues() is not fully implemented for Redis-based queues');
        return new Map();
    }
}

export const queueService = new QueueService();
