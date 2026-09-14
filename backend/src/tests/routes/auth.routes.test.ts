import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/auth.routes';
import { User } from '../../models/User';
import bcrypt from 'bcryptjs';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('email', userData.email);
            expect(response.body.user).toHaveProperty('name', userData.name);
        });

        it('should fail if required fields are missing', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({ email: 'test@example.com' })
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Password must be at least 8 characters');
        });

        it('should fail if password is too short', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({ email: 'short@example.com', password: 'short', name: 'Test User' })
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Password must be at least 8 characters');
        });

        it('should fail if email is already registered', async () => {
            const userData = {
                email: 'duplicate@example.com',
                password: 'password123',
                name: 'Test User'
            };

            await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Email already registered');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            const hashedPassword = await bcrypt.hash('password123', 10);
            await User.create({
                email: 'login@example.com',
                password: hashedPassword,
                name: 'Login User'
            });
        });

        it('should login successfully with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'password123'
                })
                .expect(200);

            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('email', 'login@example.com');
        });

        it('should fail if required fields are missing', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'login@example.com' })
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Password is required');
        });

        it('should fail if email is missing', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ password: 'password123' })
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Valid email is required');
        });

        it('should fail with invalid email', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password123'
                })
                .expect(401);

            expect(response.body).toHaveProperty('error', 'Invalid credentials');
        });

        it('should fail with invalid password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'wrongpassword'
                })
                .expect(401);

            expect(response.body).toHaveProperty('error', 'Invalid credentials');
        });
    });
});
