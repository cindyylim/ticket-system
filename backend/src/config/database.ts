import mongoose from 'mongoose';

// Cache the database connection
let cachedConnection: mongoose.Mongoose | null = null;

export const connectDatabase = async () => {
    // If we already have a connection, reuse it
    if (cachedConnection && mongoose.connection.readyState === 1) {
        console.log('Using cached MongoDB connection');
        return cachedConnection;
    }

    try {
        let uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MongoDB URI is not defined');
        }

        console.log('Creating new MongoDB connection...');
        const conn = await mongoose.connect(uri, {
            // Connection pool settings
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        cachedConnection = conn;
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error: unknown) {
        console.error('Error connecting to MongoDB:', (error as Error).message);
        // Don't exit the process, let it retry on next request
        cachedConnection = null;
        throw error;
    }
};