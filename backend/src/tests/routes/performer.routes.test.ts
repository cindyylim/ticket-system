import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import performerRoutes from '../../routes/performer.routes';
import { Performer } from '../../models/Performer';
import { cacheService } from '../../services/cache.service';

const app = express();
app.use(express.json());
app.use('/api/performers', performerRoutes);

describe('Performer Routes', () => {
    let performerId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        const performer = await Performer.create({
            name: 'Test Performer',
            genre: 'Rock',
            imageUrl: 'http://example.com/performer.jpg',
            bio: 'Test bio'
        });
        performerId = performer._id as mongoose.Types.ObjectId;
    });

    describe('GET /api/performers', () => {
        it('should get all performers', async () => {
            const response = await request(app)
                .get('/api/performers')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0]).toHaveProperty('name', 'Test Performer');
        });

        it('should filter performers by genre', async () => {
            await Performer.create({
                name: 'Jazz Performer',
                genre: 'Jazz'
            });

            const response = await request(app)
                .get('/api/performers?genre=Rock')
                .expect(200);

            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body.every((p: any) => p.genre === 'Rock')).toBe(true);
        });
    });

    describe('GET /api/performers/:id', () => {
        it('should get performer by ID', async () => {
            const response = await request(app)
                .get(`/api/performers/${performerId}`)
                .expect(200);

            expect(response.body).toHaveProperty('name', 'Test Performer');
            expect(response.body).toHaveProperty('genre', 'Rock');
        });

        it('should return 404 for non-existent performer', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/api/performers/${fakeId}`)
                .expect(404);

            expect(response.body).toHaveProperty('error', 'Performer not found');
        });

        it('should return cached result if available', async () => {
            const cachedPerformer = {
                _id: performerId.toString(),
                name: 'Cached Performer',
                genre: 'Cached Genre',
                imageUrl: 'http://example.com/cached.jpg',
                bio: 'Cached Bio'
            };

            const getSpy = jest.spyOn(cacheService, 'get').mockResolvedValue(cachedPerformer);
            const dbSpy = jest.spyOn(Performer, 'findById');

            const response = await request(app)
                .get(`/api/performers/${performerId}`)
                .expect(200);

            expect(response.body).toHaveProperty('name', 'Cached Performer');
            expect(response.body).toHaveProperty('genre', 'Cached Genre');
            expect(getSpy).toHaveBeenCalledWith(`performer:${performerId}`);
            expect(dbSpy).not.toHaveBeenCalled();

            getSpy.mockRestore();
            dbSpy.mockRestore();
        });
    });
});
