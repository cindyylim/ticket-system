import { User } from '../../models/User';

describe('User Model', () => {
    it('should create a new user successfully', async () => {
        const userData = {
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User'
        };
        const validUser = new User(userData);
        const savedUser = await validUser.save();

        expect(savedUser._id).toBeDefined();
        expect(savedUser.email).toBe(userData.email.toLowerCase());
        expect(savedUser.name).toBe(userData.name);
        expect(savedUser.password).toBe(userData.password);
        expect(savedUser.createdAt).toBeDefined();
    });

    it('should fail if required fields are missing', async () => {
        const userWithoutEmail = new User({ password: 'password123', name: 'Test User' });
        await expect(userWithoutEmail.save()).rejects.toThrow();

        const userWithoutPassword = new User({ email: 'test@example.com', name: 'Test User' });
        await expect(userWithoutPassword.save()).rejects.toThrow();

        const userWithoutName = new User({ email: 'test@example.com', password: 'password123' });
        await expect(userWithoutName.save()).rejects.toThrow();
    });

    it('should fail if email is duplicate', async () => {
        const userData = {
            email: 'duplicate@example.com',
            password: 'password123',
            name: 'Test User'
        };
        await new User(userData).save();

        const duplicateUser = new User(userData);
        await expect(duplicateUser.save()).rejects.toThrow();
    });

    it('should trim name and lowercase email', async () => {
        const userData = {
            email: '  UPPER@example.com  ',
            password: 'password123',
            name: '  Trimmed Name  '
        };
        const user = new User(userData);
        const savedUser = await user.save();

        expect(savedUser.email).toBe('upper@example.com');
        expect(savedUser.name).toBe('Trimmed Name');
    });
});
