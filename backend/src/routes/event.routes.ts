import { Router, Request, Response } from 'express';
import { Event } from '../models/Event';
import { Performer } from '../models/Performer';
import { Venue } from '../models/Venue';
import { Seat } from '../models/Seat';
import { cacheService } from '../services/cache.service';
import { Types } from 'mongoose';

const router = Router();

// Get all events with pagination and filtering
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 12;
        const category = req.query.category as string;
        const search = req.query.search as string;

        const cacheKey = cacheService.eventsListKey(page, category);

        // Try to get from cache (only if no search - search results are dynamic)
        if (!search) {
            const cached = await cacheService.get<any>(cacheKey);
            if (cached) {
                res.json(cached);
                return;
            }
        }

        // Build query
        const query: any = { status: 'upcoming', date: { $gte: new Date() } };
        if (category) query.category = category;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [events, total] = await Promise.all([
            Event.find(query)
                .populate('performerId')
                .populate('venueId')
                .sort({ date: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Event.countDocuments(query),
        ]);

        const result = {
            events,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };

        // Cache result if not searching
        if (!search) {
            await cacheService.set(cacheKey, result, 600); // 10 minutes TTL
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Get event by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const cacheKey = cacheService.eventKey(id);
        const cached = await cacheService.get<any>(cacheKey);

        if (cached) {
            res.json(cached);
            return;
        }

        const event = await Event.findById(id)
            .populate('performerId')
            .populate('venueId')
            .lean();

        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        // Cache the event
        await cacheService.set(cacheKey, event, 3600); // 1 hour TTL

        res.json(event);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

// Get seats for an event
router.get('/:id/seats', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const cacheKey = cacheService.eventSeatsKey(id);
        const cached = await cacheService.get<any>(cacheKey);

        if (cached) {
            res.json(cached);
            return;
        }

        const seats = await Seat.find({ eventId: new Types.ObjectId(id) })
            .select('-lockedBy -bookedBy') // Don't expose user IDs
            .lean();

        // Cache seats (short TTL due to real-time updates)
        await cacheService.set(cacheKey, seats, 30); // 30 seconds TTL

        res.json(seats);
    } catch (error) {
        console.error('Error fetching seats:', error);
        res.status(500).json({ error: 'Failed to fetch seats' });
    }
});

export default router;
