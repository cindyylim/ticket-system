import { Performer } from '../../models/Performer';

describe('Performer Model', () => {
    const validPerformerData = {
        name: 'Test Performer',
        genre: 'Rock',
        imageUrl: 'http://example.com/performer.jpg',
        bio: 'Test Bio'
    };

    it('should create a new performer successfully', async () => {
        const performer = new Performer(validPerformerData);
        const savedPerformer = await performer.save();

        expect(savedPerformer._id).toBeDefined();
        expect(savedPerformer.name).toBe(validPerformerData.name);
        expect(savedPerformer.genre).toBe(validPerformerData.genre);
        expect(savedPerformer.imageUrl).toBe(validPerformerData.imageUrl);
        expect(savedPerformer.bio).toBe(validPerformerData.bio);
    });

    it('should fail if required fields are missing', async () => {
        const performerWithoutName = new Performer({ ...validPerformerData, name: undefined });
        await expect(performerWithoutName.save()).rejects.toThrow();

        const performerWithoutGenre = new Performer({ ...validPerformerData, genre: undefined });
        await expect(performerWithoutGenre.save()).rejects.toThrow();
    });

    it('should use default values for imageUrl and bio', async () => {
        const minimalPerformerData = {
            name: 'Minimal Performer',
            genre: 'Jazz'
        };
        const savedPerformer = await new Performer(minimalPerformerData).save();

        expect(savedPerformer.imageUrl).toBe('');
        expect(savedPerformer.bio).toBe('');
    });

    it('should trim performer name', async () => {
        const performer = new Performer({ ...validPerformerData, name: '  Trimmed Performer  ' });
        const savedPerformer = await performer.save();

        expect(savedPerformer.name).toBe('Trimmed Performer');
    });
});
