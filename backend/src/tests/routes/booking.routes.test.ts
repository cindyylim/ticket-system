import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import bookingRoutes from '../../routes/booking.routes';
import { User } from '../../models/User';
import { Event } from '../../models/Event';
import { Seat } from '../../models/Seat';
import { Performer } from '../../models/Performer';
import { Venue } from '../../models/Venue';
import { bookingService } from '../../services/booking.service';
import { queueService } from '../../services/queue.service';
import jwt from 'jsonwebtoken';

// Mock services
jest.mock('../../services/booking.service');
jest.mock('../../services/queue.service');

const app = express();
app.use(express.json());
app.use('/api/bookings', bookingRoutes);

describe('Booking Routes', () => {
    let token: string;
    let userId: mongoose.Types.ObjectId;
    let eventId: mongoose.Types.ObjectId;
    let seatId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        // Create test user
        const user = await User.create({
            email: 'test@example.com',
            password: 'hashedpassword',
            name: 'Test User'
        });
        userId = user._id as mongoose.Types.ObjectId;
        token = jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET || 'your-super-secret-jwt-key');

        // Create test data
        const performer = await Performer.create({ name: 'Test Performer', genre: 'Rock' });
        const venue = await Venue.create({
            name: 'Test Venue',
            address: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            capacity: 1000,
            sections: []
        });

        const event = await Event.create({
            title: 'Test Event',
            performerId: performer._id,
            venueId: venue._id,
            date: new Date(),
            category: 'Concerts',
            priceTiers: [{ section: 'VIP', price: 100 }]
        });
        eventId = event._id as mongoose.Types.ObjectId;

        const seat = await Seat.create({
            eventId,
            section: 'VIP',
            row: 1,
            seatNumber: 1,
            price: 100,
            status: 'available'
        });
        seatId = seat._id as mongoose.Types.ObjectId;
    });

    describe('POST /api/bookings/lock', () => {
        it('should lock seats successfully', async () => {
            (queueService.joinQueue as jest.Mock).mockResolvedValue(1);
            (queueService.canProceed as jest.Mock).mockResolvedValue(true);
            (queueService.removeFromQueue as jest.Mock).mockResolvedValue(undefined);
            (bookingService.lockSeats as jest.Mock).mockResolvedValue({
                success: true,
                message: 'Seats locked successfully',
                lockIds: { [seatId.toString()]: 'lock-123' }
            });

            const response = await request(app)
                .post('/api/bookings/lock')
                .set('Authorization', `Bearer ${token}`)
                .send({ eventId: eventId.toString(), seatIds: [seatId.toString()] })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('lockIds');
        });

        it('should return queue position if cannot proceed', async () => {
            (queueService.joinQueue as jest.Mock).mockResolvedValue(5);
            (queueService.canProceed as jest.Mock).mockResolvedValue(false);
            (queueService.getQueueStats as jest.Mock).mockResolvedValue({ estimatedWaitTime: 300 });

            const response = await request(app)
                .post('/api/bookings/lock')
                .set('Authorization', `Bearer ${token}`)
                .send({ eventId: eventId.toString(), seatIds: [seatId.toString()] })
                .expect(200);

            expect(response.body).toHaveProperty('queued', true);
            expect(response.body).toHaveProperty('position', 5);
            expect(response.body).toHaveProperty('estimatedWaitTime', 300);
            expect(response.body).toHaveProperty('message', "You are in the waiting queue");
        });

        it('should fail without authentication', async () => {
            await request(app)
                .post('/api/bookings/lock')
                .send({ eventId: eventId.toString(), seatIds: [seatId.toString()] })
                .expect(401);
        });

        it('should fail with invalid input', async () => {
            const response = await request(app)
                .post('/api/bookings/lock')
                .set('Authorization', `Bearer ${token}`)
                .send({ eventId: eventId.toString() })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        it('should fail with invalid seats input', async () => {
            const response = await request(app)
                .post('/api/bookings/lock')
                .set('Authorization', `Bearer ${token}`)
                .send({ eventId: eventId.toString(), seatIds: [] })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        it('should fail if seats cannot be locked', async () => {
            (queueService.joinQueue as jest.Mock).mockResolvedValue(1);
            (queueService.canProceed as jest.Mock).mockResolvedValue(true);
            (queueService.removeFromQueue as jest.Mock).mockResolvedValue(undefined);
            (bookingService.lockSeats as jest.Mock).mockResolvedValue({
                success: false,
                message: 'Seats already locked'
            });

            const response = await request(app)
                .post('/api/bookings/lock')
                .set('Authorization', `Bearer ${token}`)
                .send({ eventId: eventId.toString(), seatIds: [seatId.toString()] })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/bookings/queue/:eventId', () => {
        it('should get queue status', async () => {
            (queueService.getPosition as jest.Mock).mockResolvedValue(3);
            (queueService.getQueueStats as jest.Mock).mockResolvedValue({ estimatedWaitTime: 180 });
            (queueService.canProceed as jest.Mock).mockResolvedValue(false);

            const response = await request(app)
                .get(`/api/bookings/queue/${eventId}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body).toHaveProperty('inQueue', true);
            expect(response.body).toHaveProperty('position', 3);
            expect(response.body).toHaveProperty('estimatedWaitTime', 180);
            expect(response.body).toHaveProperty('canProceed', false);
            expect(response.body).toHaveProperty('message', "You are at position 3 in the queue");
        });

        it('should fail without authentication', async () => {
            await request(app)
                .get(`/api/bookings/queue/${eventId}`)
                .expect(401);
        });
    });

    describe('POST /api/bookings/confirm', () => {
        it('should confirm booking successfully', async () => {
            (bookingService.confirmBooking as jest.Mock).mockResolvedValue({
                success: true,
                message: 'Booking confirmed',
                bookingId: 'booking-123'
            });

            const response = await request(app)
                .post('/api/bookings/confirm')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    eventId: eventId.toString(),
                    seatIds: [seatId.toString()],
                    lockIds: { [seatId.toString()]: 'lock-123' }
                })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('bookingId');
        });

        it('should fail with missing seatIds', async () => {
            await request(app)
                .post('/api/bookings/confirm')
                .set('Authorization', `Bearer ${token}`)
                .send({ eventId: eventId.toString() })
                .expect(400);
        });

        it('should fail with missing lockIds', async () => {
            await request(app)
                .post('/api/bookings/confirm')
                .set('Authorization', `Bearer ${token}`)
                .send({ eventId: eventId.toString(), seatIds: [seatId.toString()] })
                .expect(400);
        });

        it('should fail with invalid lockIds format', async () => {
            const response = await request(app)
                .post('/api/bookings/confirm')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    eventId: eventId.toString(),
                    seatIds: [seatId.toString()],
                    lockIds: ['invalid']
                })
                .expect(400);

            expect(response.body.error).toContain('Lock IDs must be an object');
        });

        it('should fail with missing lock ID for seat', async () => {
            const response = await request(app)
                .post('/api/bookings/confirm')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    eventId: eventId.toString(),
                    seatIds: [seatId.toString()],
                    lockIds: {}
                })
                .expect(400);

            expect(response.body.error).toContain('Missing lock ID');
        });
    });

    describe('POST /api/bookings/unlock', () => {
        it('should unlock seats successfully', async () => {
            (bookingService.unlockSeats as jest.Mock).mockResolvedValue({
                success: true,
                message: 'Seats unlocked'
            });

            const response = await request(app)
                .post('/api/bookings/unlock')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    seatIds: [seatId.toString()],
                    lockIds: { [seatId.toString()]: 'lock-123' }
                })
                .expect(200);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with invalid input', async () => {
            await request(app)
                .post('/api/bookings/unlock')
                .set('Authorization', `Bearer ${token}`)
                .send({ seatIds: [seatId.toString()] })
                .expect(400);
        });

        it('should fail with invalid lockIds', async () => {
            await request(app)
                .post('/api/bookings/unlock')
                .set('Authorization', `Bearer ${token}`)
                .send({ seatIds: [seatId.toString()], lockIds: {} })
                .expect(400);
        });
    });

    describe('GET /api/bookings/my-bookings', () => {
        it('should get user bookings', async () => {
            const response = await request(app)
                .get('/api/bookings/my-bookings')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should fail without authentication', async () => {
            await request(app)
                .get('/api/bookings/my-bookings')
                .expect(401);
        });
    });
});
