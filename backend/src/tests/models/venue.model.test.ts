import { Venue } from '../../models/Venue';

describe('Venue Model', () => {
    const validVenueData = {
        name: 'Test Venue',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        capacity: 1000,
        sections: [
            { name: 'Front', rows: 10, seatsPerRow: 20 },
            { name: 'Back', rows: 20, seatsPerRow: 30 }
        ],
        imageUrl: 'http://example.com/venue.jpg',
        description: 'Test Description'
    };

    it('should create a new venue successfully', async () => {
        const venue = new Venue(validVenueData);
        const savedVenue = await venue.save();

        expect(savedVenue._id).toBeDefined();
        expect(savedVenue.name).toBe(validVenueData.name);
        expect(savedVenue.city).toBe(validVenueData.city);
        expect(savedVenue.sections.length).toBe(2);
        expect(savedVenue.sections[0].name).toBe('Front');
    });

    it('should fail if required fields are missing', async () => {
        const fieldsToTest = ['name', 'address', 'city', 'state', 'zipCode', 'capacity'];
        for (const field of fieldsToTest) {
            const invalidData = { ...validVenueData, [field]: undefined };
            const venue = new Venue(invalidData);
            await expect(venue.save()).rejects.toThrow();
        }
    });

    it('should use default values for imageUrl and description', async () => {
        const minimalVenueData = {
            name: 'Minimal Venue',
            address: 'Addr',
            city: 'City',
            state: 'ST',
            zipCode: '00000',
            capacity: 100,
            sections: []
        };
        const savedVenue = await new Venue(minimalVenueData).save();

        expect(savedVenue.imageUrl).toBe('');
        expect(savedVenue.description).toBe('');
    });

    it('should fail if section data is incomplete', async () => {
        const venue = new Venue({
            ...validVenueData,
            sections: [{ name: 'Incomplete Section' }] // Missing rows and seatsPerRow
        });
        await expect(venue.save()).rejects.toThrow();
    });
});
