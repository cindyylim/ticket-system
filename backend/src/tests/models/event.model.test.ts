import mongoose from 'mongoose';
import { Event } from '../../models/Event';

describe('Event Model', () => {
    const validEventData = {
        title: 'Test Event',
        performerId: new mongoose.Types.ObjectId(),
        venueId: new mongoose.Types.ObjectId(),
        date: new Date(),
        description: 'Test Description',
        imageUrl: 'http://example.com/image.jpg',
        category: 'Concerts',
        status: 'upcoming',
        priceTiers: [
            { section: 'VIP', price: 100 },
            { section: 'General Admisson', price: 50 }
        ]
    };

    it('should create a new event successfully', async () => {
        const validEvent = new Event(validEventData);
        const savedEvent = await validEvent.save();

        expect(savedEvent._id).toBeDefined();
        expect(savedEvent.title).toBe(validEventData.title);
        expect(savedEvent.performerId).toEqual(validEventData.performerId);
        expect(savedEvent.venueId).toEqual(validEventData.venueId);
        expect(savedEvent.category).toBe(validEventData.category);
        expect(savedEvent.status).toBe('upcoming');
        expect(savedEvent.priceTiers.length).toBe(2);
    });

    it('should fail if required fields are missing', async () => {
        const eventWithoutTitle = new Event({ ...validEventData, title: undefined });
        await expect(eventWithoutTitle.save()).rejects.toThrow();

        const eventWithoutPerformer = new Event({ ...validEventData, performerId: undefined });
        await expect(eventWithoutPerformer.save()).rejects.toThrow();

        const eventWithoutVenue = new Event({ ...validEventData, venueId: undefined });
        await expect(eventWithoutVenue.save()).rejects.toThrow();

        const eventWithoutDate = new Event({ ...validEventData, date: undefined });
        await expect(eventWithoutDate.save()).rejects.toThrow();

        const eventWithoutCategory = new Event({ ...validEventData, category: undefined });
        await expect(eventWithoutCategory.save()).rejects.toThrow();
    });

    it('should use default values for description, imageUrl, and status', async () => {
        const minimalEventData = {
            title: 'Minimal Event',
            performerId: new mongoose.Types.ObjectId(),
            venueId: new mongoose.Types.ObjectId(),
            date: new Date(),
            category: 'Sports',
            priceTiers: [{ section: 'Standard', price: 20 }]
        };
        const savedEvent = await new Event(minimalEventData).save();

        expect(savedEvent.description).toBe('');
        expect(savedEvent.imageUrl).toBe('');
        expect(savedEvent.status).toBe('upcoming');
    });

    it('should fail if status is invalid', async () => {
        const invalidEvent = new Event({ ...validEventData, status: 'invalid-status' });
        await expect(invalidEvent.save()).rejects.toThrow();
    });

    it('should fail if priceTiers are invalid', async () => {
        const eventWithInvalidPriceTier = new Event({
            ...validEventData,
            priceTiers: [{ section: 'VIP' }] // Missing price
        });
        await expect(eventWithInvalidPriceTier.save()).rejects.toThrow();
    });
});
