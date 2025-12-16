import { Router, Request, Response } from 'express';
import { sseService } from '../services/sse.service';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// SSE endpoint for seat updates
router.get('/events/:eventId/seats', (req: Request, res: Response): void => {
    const { eventId } = req.params;
    const clientId = uuidv4();

    // Add client to SSE service
    sseService.addClient(clientId, eventId, res);

    // Client will be automatically removed when connection closes
});

export default router;
