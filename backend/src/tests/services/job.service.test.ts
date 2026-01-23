import { jobService } from '../../services/job.service';

// Mock booking service
jest.mock('../../services/booking.service');

describe('JobService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await jobService.disconnect();
    });

    describe('scheduleCleanupJob', () => {
        it('should schedule the cleanup job correctly', async () => {
            const queue = await jobService.getQueue();
            (queue.getRepeatableJobs as jest.Mock).mockResolvedValue([]);
            (queue.add as jest.Mock).mockResolvedValue({ id: 'job-id' });

            await jobService.scheduleCleanupJob();

            expect(queue.getRepeatableJobs).toHaveBeenCalled();
            expect(queue.add).toHaveBeenCalledWith(
                'cleanup-expired-locks',
                {},
                expect.objectContaining({
                    repeat: { pattern: '*/1 * * * *' }
                })
            );
        });

        it('should remove existing repeatable jobs before adding new one', async () => {
            const queue = await jobService.getQueue();
            (queue.getRepeatableJobs as jest.Mock).mockResolvedValue([
                { key: 'old-job-key' }
            ]);
            (queue.removeRepeatableByKey as jest.Mock).mockResolvedValue(undefined);

            await jobService.scheduleCleanupJob();

            expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('old-job-key');
            expect(queue.add).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            const queue = await jobService.getQueue();
            (queue.getRepeatableJobs as jest.Mock).mockRejectedValue(new Error('Redis error'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await jobService.scheduleCleanupJob();

            expect(consoleSpy).toHaveBeenCalledWith('Failed to schedule cleanup job:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});
