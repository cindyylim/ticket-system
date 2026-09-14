import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import { errorHandler } from './middleware/error.middleware';
import { jobService } from './services/job.service';
import { getJwtSecret } from './config/auth';

// Import routes
import authRoutes from './routes/auth.routes';
import eventRoutes from './routes/event.routes';
import venueRoutes from './routes/venue.routes';
import performerRoutes from './routes/performer.routes';
import bookingRoutes from './routes/booking.routes';
import sseRoutes from './routes/sse.routes';
import queueRoutes from './routes/queue.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : process.env.NODE_ENV === 'production'
        ? false
        : 'http://localhost:5173';

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/performers', performerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/sse', sseRoutes);
app.use('/api/queue', queueRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDatabase();
        getJwtSecret();

        await jobService.scheduleCleanupJob();
        await jobService.scheduleQueueProcessorJob();

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📡 SSE endpoint: http://localhost:${PORT}/api/sse/events/:eventId/seats`);
            console.log(`🔒 Distributed locking enabled with 10-minute TTL`);
            console.log(`📋 Virtual queue system active`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
