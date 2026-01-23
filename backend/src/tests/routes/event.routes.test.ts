import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import eventRoutes from '../../routes/event.routes';
import { Event } from '../../models/Event';
import { Performer } from '../../models/Performer';
import { Venue } from '../../models/Venue';
import { Seat } from '../../models/Seat';

const app = express();
app.use(express.json());
app.use('/api/events', eventRoutes);

describe('Event Routes', () => {
    let performerId: mongoose.Types.ObjectId;
    let venueId: mongoose.Types.ObjectId;
    let eventId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        // Create test performer and venue
        const performer = await Performer.create({
            name: 'Test Performer',
            genre: 'Rock',
            imageUrl: 'http://example.com/performer.jpg',
            bio: 'Test bio'
        });
        performerId = performer._id as mongoose.Types.ObjectId;

        const venue = await Venue.create({
            name: 'Test Venue',
            address: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            capacity: 1000,
            sections: [{ name: 'VIP', rows: 10, seatsPerRow: 20 }]
        });
        venueId = venue._id as mongoose.Types.ObjectId;

        // Create test event
        const event = await Event.create({
            title: 'Test Event',
            performerId,
            venueId,
            date: new Date(Date.now() + 86400000), // Tomorrow
            description: 'Test Description',
            imageUrl: 'http://example.com/event.jpg',
            category: 'Concerts',
            status: 'upcoming',
            priceTiers: [{ section: 'VIP', price: 100 }]
        });
        eventId = event._id as mongoose.Types.ObjectId;

        // Create test seats
        await Seat.create({
            eventId,
            section: 'VIP',
            row: 1,
            seatNumber: 1,
            price: 100,
            status: 'available'
        });
    });

    describe('GET /api/events', () => {
        it('should get all events with pagination', async () => {
            const response = await request(app)
                .get('/api/events')
                .expect(200);

            expect(response.body).toHaveProperty('events');
            expect(response.body).toHaveProperty('pagination');
            expect(response.body.pagination).toHaveProperty('page', 1);
            expect(response.body.events.length).toBeGreaterThan(0);
        });

        it('should filter events by category', async () => {
            const response = await request(app)
                .get('/api/events?category=Concerts')
                .expect(200);

            expect(response.body.events.length).toBeGreaterThan(0);
            expect(response.body.events[0].category).toBe('Concerts');
        });

        it('should search events by title', async () => {
            const response = await request(app)
                .get('/api/events?search=Test')
                .expect(200);

            expect(response.body.events.length).toBeGreaterThan(0);
        });

        it('should handle pagination parameters', async () => {
            const response = await request(app)
                .get('/api/events?page=1&limit=5')
                .expect(200);

            expect(response.body.pagination.page).toBe(1);
            expect(response.body.pagination.limit).toBe(5);
        });
    });

    describe('GET /api/events/:id', () => {
        it('should get event by ID', async () => {
            const response = await request(app)
                .get(`/api/events/${eventId}`)
                .expect(200);

            expect(response.body).toHaveProperty('title', 'Test Event');
            expect(response.body).toHaveProperty('category', 'Concerts');
        });

        it('should return 404 for non-existent event', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/api/events/${fakeId}`)
                .expect(404);

            expect(response.body).toHaveProperty('error', 'Event not found');
        });
    });

    describe('GET /api/events/:id/seats', () => {
        it('should get seats for an event', async () => {
            const response = await request(app)
                .get(`/api/events/${eventId}/seats`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0]).toHaveProperty('section', 'VIP');
            expect(response.body[0]).toHaveProperty('status', 'available');
            expect(response.body[0]).not.toHaveProperty('lockedBy');
            expect(response.body[0]).not.toHaveProperty('bookedBy');
        });
    });
});
