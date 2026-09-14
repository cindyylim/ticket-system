import request from 'supertest';
import express from 'express';
import queueRoutes from '../../routes/queue.routes';
import { queueService } from '../../services/queue.service';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Mock services
jest.mock('../../services/queue.service');

const app = express();
app.use(express.json());
app.use('/api/queue', queueRoutes);

describe('Queue Routes', () => {
    let token: string;
    let userId: string;
    let eventId: string;

    beforeEach(() => {
        userId = new mongoose.Types.ObjectId().toString();
        eventId = new mongoose.Types.ObjectId().toString();
        token = jwt.sign({ userId }, process.env.JWT_SECRET || 'your-super-secret-jwt-key');
        jest.clearAllMocks();
    });

    describe('GET /api/queue/status/:eventId', () => {
        it('should return queue status successfully', async () => {
            (queueService.getPosition as jest.Mock).mockResolvedValue(5);
            (queueService.getQueueStats as jest.Mock).mockResolvedValue({
                length: 10,
                estimatedWaitTime: 600
            });
            (queueService.canProceed as jest.Mock).mockResolvedValue(false);

            const response = await request(app)
                .get(`/api/queue/status/${eventId}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body).toEqual({
                position: 5,
                canProceed: false,
                queueLength: 10,
                estimatedWaitTime: 600
            });
            expect(queueService.getPosition).toHaveBeenCalledWith(eventId, userId);
            expect(queueService.getQueueStats).toHaveBeenCalledWith(eventId);
            expect(queueService.canProceed).toHaveBeenCalledWith(eventId, userId);
        });

        it('should return 401 if not authenticated', async () => {
            await request(app)
                .get(`/api/queue/status/${eventId}`)
                .expect(401);

            expect(queueService.getPosition).not.toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            (queueService.getPosition as jest.Mock).mockRejectedValue(new Error('Redis error'));

            const response = await request(app)
                .get(`/api/queue/status/${eventId}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(500);

            expect(response.body).toHaveProperty('error', 'Failed to get queue status');
        });
    });

    describe('POST /api/queue/leave/:eventId', () => {
        it('should remove the user from the waiting room', async () => {
            (queueService.removeFromQueue as jest.Mock).mockResolvedValue(undefined);

            const response = await request(app)
                .post(`/api/queue/leave/${eventId}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body).toEqual({ left: true });
            expect(queueService.removeFromQueue).toHaveBeenCalledWith(eventId, userId);
        });

        it('should return 401 if not authenticated', async () => {
            await request(app)
                .post(`/api/queue/leave/${eventId}`)
                .expect(401);
        });
    });
});
