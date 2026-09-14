import { Queue, Worker, Job } from 'bullmq';
import { bookingService } from './booking.service';
import { queueService } from './queue.service';
import dotenv from 'dotenv';

dotenv.config();

class JobService {
    private cleanupQueue: Queue;
    private admissionQueue: Queue;
    private cleanupWorker: Worker;
    private admissionWorker: Worker;
    private readonly REDIS_OPTIONS = {
        connection: {
            url: process.env.REDIS_URI || 'redis://localhost:6379',
        },
    };

    constructor() {
        this.cleanupQueue = new Queue('lock-cleanup', this.REDIS_OPTIONS);
        this.admissionQueue = new Queue('waiting-queue', this.REDIS_OPTIONS);

        this.cleanupWorker = new Worker(
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

        this.admissionWorker = new Worker(
            'waiting-queue',
            async (job: Job) => {
                if (job.name === 'process-waiting-queues') {
                    await queueService.processPendingQueues();
                }
            },
            this.REDIS_OPTIONS
        );

        const onCompleted = (job: Job) => {
            console.log(`Job ${job.id} completed!`);
        };
        const onFailed = (job: Job | undefined, err: Error) => {
            console.error(`Job ${job?.id} failed with error: ${err.message}`);
        };

        this.cleanupWorker.on('completed', onCompleted);
        this.cleanupWorker.on('failed', onFailed);
        this.admissionWorker.on('completed', onCompleted);
        this.admissionWorker.on('failed', onFailed);

        console.log('🚀 JobService initialized with BullMQ');
    }

    async scheduleCleanupJob() {
        try {
            const repeatableJobs = await this.cleanupQueue.getRepeatableJobs();
            for (const job of repeatableJobs) {
                await this.cleanupQueue.removeRepeatableByKey(job.key);
            }

            await this.cleanupQueue.add(
                'cleanup-expired-locks',
                {},
                {
                    repeat: {
                        pattern: '*/1 * * * *',
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

    async scheduleQueueProcessorJob() {
        try {
            const repeatableJobs = await this.admissionQueue.getRepeatableJobs();
            for (const job of repeatableJobs) {
                await this.admissionQueue.removeRepeatableByKey(job.key);
            }

            await this.admissionQueue.add(
                'process-waiting-queues',
                {},
                {
                    repeat: {
                        every: 2000,
                    },
                    removeOnComplete: true,
                    removeOnFail: true,
                }
            );

            console.log('📅 Waiting-queue processor scheduled every 2 seconds');
        } catch (error) {
            console.error('Failed to schedule queue processor job:', error);
        }
    }

    async getQueue() {
        return this.cleanupQueue;
    }

    async getAdmissionQueue() {
        return this.admissionQueue;
    }

    async disconnect() {
        await this.cleanupWorker.close();
        await this.admissionWorker.close();
        await this.cleanupQueue.close();
        await this.admissionQueue.close();
    }
}

export const jobService = new JobService();
