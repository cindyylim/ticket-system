import { Router, Response } from 'express';
import { Booking } from '../models/Booking';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { bookingService } from '../services/booking.service';
import { queueService } from '../services/queue.service';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Lock seats (join queue and acquire distributed lock)
router.post('/lock', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { eventId, seatIds } = req.body;
        const userId = req.userId!;

        if (!eventId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
            res.status(400).json({ error: 'Event ID and seat IDs are required' });
            return;
        }

        // Join queue
        const requestId = uuidv4();
        const position = await queueService.joinQueue(eventId, userId, requestId);

        // Check if can proceed
        if (!(await queueService.canProceed(eventId, userId))) {
            const stats = await queueService.getQueueStats(eventId);
            res.json({
                queued: true,
                position,
                estimatedWaitTime: stats.estimatedWaitTime,
                message: 'You are in the waiting queue',
            });
            return;
        }

        // Try to lock seats
        const result = await bookingService.lockSeats(eventId, seatIds, userId);
        await queueService.removeFromQueue(eventId, userId);

        if (result.success) {
            res.json({
                success: true,
                lockIds: result.lockIds,
                expiresIn: 600, // 10 minutes in seconds
                message: result.message,
            });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        console.error('Error locking seats:', error);
        res.status(500).json({ error: 'Failed to lock seats' });
    }
});

// Get queue status
router.get('/queue/:eventId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { eventId } = req.params;
        const userId = req.userId!;

        const position = await queueService.getPosition(eventId, userId);
        const stats = await queueService.getQueueStats(eventId);
        const canProceed = await queueService.canProceed(eventId, userId);

        res.json({
            inQueue: position !== null,
            position,
            estimatedWaitTime: stats.estimatedWaitTime,
            canProceed,
            message: position !== null
                ? `You are at position ${position} in the queue`
                : 'You are not in the queue',
        });
    } catch (error) {
        console.error('Error fetching queue status:', error);
        res.status(500).json({ error: 'Failed to fetch queue status' });
    }
});

router.post('/confirm', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { eventId, seatIds, lockIds } = req.body;
        const userId = req.userId!;

        if (!eventId || !seatIds || !lockIds) {
            res.status(400).json({ error: 'Event ID, seat IDs, and lock IDs are required' });
            return;
        }

        // Validate that lockIds is an object with seat IDs as keys
        if (typeof lockIds !== 'object' || Array.isArray(lockIds)) {
            res.status(400).json({ error: 'Lock IDs must be an object with seat IDs as keys' });
            return;
        }

        // Validate that all seat IDs have corresponding lock IDs
        for (const seatId of seatIds) {
            if (!lockIds[seatId]) {
                res.status(400).json({ error: `Missing lock ID for seat ${seatId}` });
                return;
            }
        }

        const result = await bookingService.confirmBooking(eventId, seatIds, userId, lockIds);

        if (result.success) {
            res.json({
                success: true,
                bookingId: result.bookingId,
                message: result.message,
            });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        console.error('Error confirming booking:', error);
        res.status(500).json({ error: 'Failed to confirm booking' });
    }
});

// Cancel/unlock seats
router.post('/unlock', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { seatIds, lockIds } = req.body;
        const userId = req.userId!;

        if (!seatIds || !lockIds) {
            res.status(400).json({ error: 'Seat IDs and lock IDs are required' });
            return;
        }

        // Validate that lockIds is an object with seat IDs as keys
        if (typeof lockIds !== 'object' || Array.isArray(lockIds)) {
            res.status(400).json({ error: 'Lock IDs must be an object with seat IDs as keys' });
            return;
        }

        // Validate that all seat IDs have corresponding lock IDs
        for (const seatId of seatIds) {
            if (!lockIds[seatId]) {
                res.status(400).json({ error: `Missing lock ID for seat ${seatId}` });
                return;
            }
        }

        const result = await bookingService.unlockSeats(seatIds, userId, lockIds);

        if (result.success) {
            res.json({ message: result.message });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        console.error('Error unlocking seats:', error);
        res.status(500).json({ error: 'Failed to unlock seats' });
    }
});

// Get user's bookings
router.get('/my-bookings', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId!;

        const bookings = await Booking.find({ userId })
            .populate('eventId')
            .populate('seatIds')
            .sort({ createdAt: -1 })
            .lean();

        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

export default router;
