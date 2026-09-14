import { getJwtSecret } from '../../config/auth';

describe('getJwtSecret', () => {
    it('returns the configured secret', () => {
        expect(getJwtSecret()).toBe(process.env.JWT_SECRET);
    });

    it('throws when the secret is missing', () => {
        const previous = process.env.JWT_SECRET;
        delete process.env.JWT_SECRET;
        expect(() => getJwtSecret()).toThrow('JWT_SECRET is required');
        process.env.JWT_SECRET = previous;
    });
});
