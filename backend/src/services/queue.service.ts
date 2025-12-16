interface QueueEntry {
    userId: string;
    timestamp: number;
    requestId: string;
}

class QueueService {
    private queue: Map<string, QueueEntry[]> = new Map(); // eventId -> queue entries (waiting users)
    private activeUsers: Map<string, Set<string>> = new Map(); // eventId -> active users (allowed to proceed)
    private readonly MAX_CONCURRENT_PROCESSING = 10; // Process 10 bookings at a time per event
    private readonly PROCESSING_INTERVAL = 2000; // Process every 2 seconds
    private processingIntervals: Map<string, NodeJS.Timeout> = new Map();

    // Join queue for an event
    joinQueue(eventId: string, userId: string, requestId: string): number {
        // If user is already active, return 0 (meaning pass through)
        if (this.canProceed(eventId, userId)) {
            return 0;
        }

        if (!this.queue.has(eventId)) {
            this.queue.set(eventId, []);
            this.startProcessing(eventId);
        }

        const eventQueue = this.queue.get(eventId)!;

        // Check if user is already in queue
        const existingIndex = eventQueue.findIndex(entry => entry.userId === userId);
        if (existingIndex !== -1) {
            return existingIndex + 1; // Return existing position (1-indexed)
        }

        eventQueue.push({
            userId,
            timestamp: Date.now(),
            requestId,
        });

        const position = eventQueue.length;
        console.log(`📋 User ${userId} joined queue for event ${eventId} at position ${position}`);

        return position;
    }

    // Get user's position in queue
    getPosition(eventId: string, userId: string): number | null {
        // If active, they are not in the "waiting" queue
        if (this.canProceed(eventId, userId)) {
            return 0;
        }

        const eventQueue = this.queue.get(eventId);
        if (!eventQueue) return null;

        const index = eventQueue.findIndex(entry => entry.userId === userId);
        return index === -1 ? null : index + 1; // 1-indexed
    }

    // Remove user from queue (after successful booking or cancellation)
    removeFromQueue(eventId: string, userId: string): void {
        // Remove from active users if present
        if (this.activeUsers.has(eventId)) {
            this.activeUsers.get(eventId)!.delete(userId);
        }

        // Remove from waiting queue if present
        const eventQueue = this.queue.get(eventId);
        if (eventQueue) {
            const index = eventQueue.findIndex(entry => entry.userId === userId);
            if (index !== -1) {
                eventQueue.splice(index, 1);
                console.log(`📋 User ${userId} removed from queue for event ${eventId}`);
            }

            // Clean up if everything is empty
            if (eventQueue.length === 0 && (!this.activeUsers.has(eventId) || this.activeUsers.get(eventId)!.size === 0)) {
                this.stopProcessing(eventId);
                this.queue.delete(eventId);
                this.activeUsers.delete(eventId);
            }
        }
    }

    // Check if user can proceed (is in active set)
    canProceed(eventId: string, userId: string): boolean {
        // If we have an active set for this event, check if user is in it
        return this.activeUsers.get(eventId)?.has(userId) ?? false;
    }

    // Get queue stats
    getQueueStats(eventId: string): { length: number; estimatedWaitTime: number } {
        const eventQueue = this.queue.get(eventId);
        if (!eventQueue) {
            return { length: 0, estimatedWaitTime: 0 };
        }

        const length = eventQueue.length;
        // Estimate: each batch processes every PROCESSING_INTERVAL ms
        const batchesAhead = Math.ceil(length / this.MAX_CONCURRENT_PROCESSING);
        const estimatedWaitTime = batchesAhead * this.PROCESSING_INTERVAL;

        return { length, estimatedWaitTime };
    }

    // Start processing queue (allow users to proceed in batches)
    private startProcessing(eventId: string): void {
        if (this.processingIntervals.has(eventId)) return;

        // Initialize active users set if needed
        if (!this.activeUsers.has(eventId)) {
            this.activeUsers.set(eventId, new Set());
        }

        console.log(`🚀 Starting queue processing for event ${eventId}`);

        const interval = setInterval(() => {
            const eventQueue = this.queue.get(eventId);
            const activeSet = this.activeUsers.get(eventId);

            // Safety check
            if (!eventQueue || !activeSet) {
                this.stopProcessing(eventId);
                return;
            }

            // If queue is empty, we just wait for more users or eventual cleanup
            if (eventQueue.length === 0) {
                if (activeSet.size === 0) {
                    this.stopProcessing(eventId);
                }
                return;
            }

            // Process a batch of users
            // We take up to MAX_CONCURRENT_PROCESSING users from the front of the queue
            const batchSize = Math.min(this.MAX_CONCURRENT_PROCESSING, eventQueue.length);

            if (batchSize > 0) {
                const batch = eventQueue.splice(0, batchSize);

                batch.forEach(entry => {
                    activeSet.add(entry.userId);
                    console.log(`✅ User ${entry.userId} moved to active state for event ${eventId}`);
                });

                console.log(`📋 Processed batch of ${batchSize} users. Remaining in queue: ${eventQueue.length}`);
            }

        }, this.PROCESSING_INTERVAL);

        this.processingIntervals.set(eventId, interval);
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
    getAllQueues(): Map<string, QueueEntry[]> {
        return this.queue;
    }
}

export const queueService = new QueueService();
