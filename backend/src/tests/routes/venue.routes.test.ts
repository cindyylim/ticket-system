import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import venueRoutes from '../../routes/venue.routes';
import { Venue } from '../../models/Venue';
import { cacheService } from '../../services/cache.service';

const app = express();
app.use(express.json());
app.use('/api/venues', venueRoutes);

describe('Venue Routes', () => {
    let venueId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        const venue = await Venue.create({
            name: 'Test Venue',
            address: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            capacity: 1000,
            sections: [
                { name: 'VIP', rows: 10, seatsPerRow: 20 },
                { name: 'General', rows: 20, seatsPerRow: 30 }
            ]
        });
        venueId = venue._id as mongoose.Types.ObjectId;
    });

    describe('GET /api/venues', () => {
        it('should get all venues', async () => {
            const response = await request(app)
                .get('/api/venues')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0]).toHaveProperty('name', 'Test Venue');
        });
    });

    describe('GET /api/venues/:id', () => {
        it('should get venue by ID', async () => {
            const response = await request(app)
                .get(`/api/venues/${venueId}`)
                .expect(200);

            expect(response.body).toHaveProperty('name', 'Test Venue');
            expect(response.body).toHaveProperty('city', 'Test City');
            expect(response.body.sections.length).toBe(2);
        });

        it('should return 404 for non-existent venue', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/api/venues/${fakeId}`)
                .expect(404);

            expect(response.body).toHaveProperty('error', 'Venue not found');
        });

        it('should return cached result if available', async () => {
            const cachedVenue = {
                _id: venueId.toString(),
                name: 'Cached Venue',
                address: 'Cached Address',
                city: 'Cached City',
                state: 'CC',
                zipCode: '54321',
                capacity: 2000,
                sections: []
            };

            const getSpy = jest.spyOn(cacheService, 'get').mockResolvedValue(cachedVenue);
            const dbSpy = jest.spyOn(Venue, 'findById');

            const response = await request(app)
                .get(`/api/venues/${venueId}`)
                .expect(200);

            expect(response.body).toHaveProperty('name', 'Cached Venue');
            expect(response.body).toHaveProperty('city', 'Cached City');
            expect(getSpy).toHaveBeenCalledWith(`venue:${venueId}`);
            expect(dbSpy).not.toHaveBeenCalled();

            getSpy.mockRestore();
            dbSpy.mockRestore();
        });
    });
});
