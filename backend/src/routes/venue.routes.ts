import { Router, Request, Response } from 'express';
import { Venue } from '../models/Venue';
import { cacheService } from '../services/cache.service';

const router = Router();

// Get all venues
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const venues = await Venue.find().lean();
        res.json(venues);
    } catch (error) {
        console.error('Error fetching venues:', error);
        res.status(500).json({ error: 'Failed to fetch venues' });
    }
});

// Get venue by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const cacheKey = cacheService.venueKey(id);
        const cached = await cacheService.get<any>(cacheKey);

        if (cached) {
            res.json(cached);
            return;
        }

        const venue = await Venue.findById(id).lean();

        if (!venue) {
            res.status(404).json({ error: 'Venue not found' });
            return;
        }

        await cacheService.set(cacheKey, venue, 3600); // 1 hour TTL

        res.json(venue);
    } catch (error) {
        console.error('Error fetching venue:', error);
        res.status(500).json({ error: 'Failed to fetch venue' });
    }
});

export default router;
