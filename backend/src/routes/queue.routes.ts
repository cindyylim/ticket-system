import { Router, Response } from 'express';
import { queueService } from '../services/queue.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Get queue status for user
router.get('/status/:eventId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { eventId } = req.params;
        const userId = req.userId!;

        const position = await queueService.getPosition(eventId, userId);
        const stats = await queueService.getQueueStats(eventId);
        const canProceed = await queueService.canProceed(eventId, userId);

        res.json({
            position,
            canProceed,
            queueLength: stats.length,
            estimatedWaitTime: stats.estimatedWaitTime,
        });
    } catch (error) {
        console.error('Error getting queue status:', error);
        res.status(500).json({ error: 'Failed to get queue status' });
    }
});

export default router;
