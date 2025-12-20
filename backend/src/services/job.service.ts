import { Queue, Worker, Job } from 'bullmq';
import { bookingService } from './booking.service';
import dotenv from 'dotenv';

dotenv.config();

class JobService {
    private cleanupQueue: Queue;
    private worker: Worker;
    private readonly REDIS_OPTIONS = {
        connection: {
            url: process.env.REDIS_URI || 'redis://localhost:6379',
        },
    };

    constructor() {
        // Initialize the queue
        this.cleanupQueue = new Queue('lock-cleanup', this.REDIS_OPTIONS);

        // Initialize the worker
        this.worker = new Worker(
            'lock-cleanup',
            async (job: Job) => {
                if (job.name === 'cleanup-expired-locks') {
                    console.log('🧹 BullMQ: Starting expired locks cleanup job...');
                    await bookingService.cleanupExpiredLocks();
                    console.log('✅ BullMQ: Expired locks cleanup job completed.');
                }
            },
            this.REDIS_OPTIONS
        );

        this.worker.on('completed', (job) => {
            console.log(`Job ${job.id} completed!`);
        });

        this.worker.on('failed', (job, err) => {
            console.error(`Job ${job?.id} failed with error: ${err.message}`);
        });

        console.log('🚀 JobService initialized with BullMQ');
    }

    // Schedule repeatable cleanup job
    async scheduleCleanupJob() {
        try {
            // Remove existing repeatable jobs to avoid duplicates if service restarts
            const repeatableJobs = await this.cleanupQueue.getRepeatableJobs();
            for (const job of repeatableJobs) {
                await this.cleanupQueue.removeRepeatableByKey(job.key);
            }

            // Add the repeatable job (runs every 1 minute)
            await this.cleanupQueue.add(
                'cleanup-expired-locks',
                {},
                {
                    repeat: {
                        pattern: '*/1 * * * *', // Every minute
                    },
                    removeOnComplete: true,
                    removeOnFail: true,
                }
            );

            console.log('📅 Lock cleanup job scheduled to run every minute');
        } catch (error) {
            console.error('Failed to schedule cleanup job:', error);
        }
    }

    async getQueue() {
        return this.cleanupQueue;
    }

    async disconnect() {
        await this.worker.close();
        await this.cleanupQueue.close();
    }
}

export const jobService = new JobService();
