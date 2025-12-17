import { Response } from 'express';
import { redisService } from './redis.service';

interface SseClient {
    id: string;
    response: Response;
    eventId: string;
}

class SseService {
    private clients: Map<string, SseClient> = new Map(); // clientId -> client
    private eventChannels: Map<string, Set<string>> = new Map(); // eventId -> Set of clientIds
    private readonly REDIS_CHANNEL_PREFIX = 'event:';
    private readonly REDIS_CHANNEL_SUFFIX = ':updates';

    constructor() {
        this.initRedisSubscription();
    }

    private async initRedisSubscription(): Promise<void> {
        try {
            await redisService.psubscribe(`${this.REDIS_CHANNEL_PREFIX}*${this.REDIS_CHANNEL_SUFFIX}`, (channel, message) => {
                const eventId = channel.replace(this.REDIS_CHANNEL_PREFIX, '').replace(this.REDIS_CHANNEL_SUFFIX, '');
                const data = JSON.parse(message);

                console.log(`📡 SSE received Redis message for event ${eventId}`);
                this.localBroadcast(eventId, data);
            });
            console.log('📡 SSE service subscribed to Redis updates');
        } catch (error) {
            console.error('❌ Failed to initialize Redis subscription for SSE:', error);
        }
    }

    // Register a new SSE client
    addClient(clientId: string, eventId: string, response: Response): void {
        // Set up SSE headers
        response.setHeader('Content-Type', 'text/event-stream');
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('Connection', 'keep-alive');
        response.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

        // Add client to registry
        this.clients.set(clientId, { id: clientId, response, eventId });

        // Add to event channel
        if (!this.eventChannels.has(eventId)) {
            this.eventChannels.set(eventId, new Set());
        }
        this.eventChannels.get(eventId)!.add(clientId);

        console.log(`📡 SSE client ${clientId} connected for event ${eventId}`);
        console.log(`📡 Total clients for event ${eventId}: ${this.eventChannels.get(eventId)!.size}`);

        // Send initial connection confirmation
        this.sendToClient(clientId, { type: 'connected', message: 'SSE connection established' });

        // Set up heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
            if (this.clients.has(clientId)) {
                this.sendToClient(clientId, { type: 'heartbeat', timestamp: Date.now() });
            } else {
                clearInterval(heartbeatInterval);
            }
        }, 30000); // Every 30 seconds

        // Handle client disconnect
        response.on('close', () => {
            clearInterval(heartbeatInterval);
            this.removeClient(clientId);
        });
    }

    // Remove a client
    removeClient(clientId: string): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { eventId } = client;

        // Remove from event channel
        const channel = this.eventChannels.get(eventId);
        if (channel) {
            channel.delete(clientId);
            if (channel.size === 0) {
                this.eventChannels.delete(eventId);
            }
        }

        // Remove from clients registry
        this.clients.delete(clientId);

        console.log(`📡 SSE client ${clientId} disconnected from event ${eventId}`);
    }

    // Send message to specific client
    sendToClient(clientId: string, data: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        try {
            client.response.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
            console.error(`Error sending to client ${clientId}:`, error);
            this.removeClient(clientId);
        }
    }

    // Broadcast message to all instances via Redis
    async broadcastToEvent(eventId: string, data: any): Promise<void> {
        try {
            const channel = `${this.REDIS_CHANNEL_PREFIX}${eventId}${this.REDIS_CHANNEL_SUFFIX}`;
            await redisService.publish(channel, JSON.stringify(data));
        } catch (error) {
            console.error(`❌ Error publishing SSE update to Redis for event ${eventId}:`, error);
            // Fallback to local broadcast if Redis fails
            this.localBroadcast(eventId, data);
        }
    }

    // Broadcast message only to clients connected to this instance
    private localBroadcast(eventId: string, data: any): void {
        const channel = this.eventChannels.get(eventId);
        if (!channel || channel.size === 0) {
            return;
        }

        console.log(`📡 Local broadcasting to ${channel.size} clients for event ${eventId}`);

        for (const clientId of channel) {
            this.sendToClient(clientId, data);
        }
    }

    // Broadcast seat update to all clients watching an event
    broadcastSeatUpdate(eventId: string, seats: any[]): void {
        this.broadcastToEvent(eventId, {
            type: 'seatUpdate',
            eventId,
            seats,
            timestamp: Date.now(),
        });
    }

    // Get stats
    getStats(): { totalClients: number; eventChannels: number } {
        return {
            totalClients: this.clients.size,
            eventChannels: this.eventChannels.size,
        };
    }
}

export const sseService = new SseService();
