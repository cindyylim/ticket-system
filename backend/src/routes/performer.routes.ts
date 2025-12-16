import { Router, Request, Response } from 'express';
import { Performer } from '../models/Performer';
import { cacheService } from '../services/cache.service';

const router = Router();

// Get all performers
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const genre = req.query.genre as string;
        const query = genre ? { genre } : {};

        const performers = await Performer.find(query).lean();
        res.json(performers);
    } catch (error) {
        console.error('Error fetching performers:', error);
        res.status(500).json({ error: 'Failed to fetch performers' });
    }
});

// Get performer by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const cacheKey = cacheService.performerKey(id);
        const cached = await cacheService.get<any>(cacheKey);

        if (cached) {
            res.json(cached);
            return;
        }

        const performer = await Performer.findById(id).lean();

        if (!performer) {
            res.status(404).json({ error: 'Performer not found' });
            return;
        }

        await cacheService.set(cacheKey, performer, 3600); // 1 hour TTL

        res.json(performer);
    } catch (error) {
        console.error('Error fetching performer:', error);
        res.status(500).json({ error: 'Failed to fetch performer' });
    }
});

export default router;
