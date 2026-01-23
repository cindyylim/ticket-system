import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

// Mock Redis
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        quit: jest.fn(),
        on: jest.fn(),
        pipeline: jest.fn().mockReturnValue({
            exec: jest.fn()
        }),
        multi: jest.fn().mockReturnValue({
            exec: jest.fn()
        })
    }));
});

// Mock BullMQ
jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: jest.fn(),
        process: jest.fn(),
        on: jest.fn(),
        close: jest.fn(),
        getRepeatableJobs: jest.fn(),
        removeRepeatableByKey: jest.fn()
    })),
    Worker: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        close: jest.fn()
    }))
}));

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
        instance: {
            dbName: 'test',
            storageEngine: 'ephemeralForTest',
        },
        binary: {
            version: '6.0.4',
        }
    });
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
}, 60000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
});

beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
    jest.clearAllMocks();
});
