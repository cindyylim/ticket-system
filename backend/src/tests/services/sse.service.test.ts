import { sseService } from '../../services/sse.service';
import { redisService } from '../../services/redis.service';

jest.mock('../../services/redis.service');

describe('SseService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('addClient', () => {
        it('should register a new SSE client', () => {
            const mockResponse: any = {
                setHeader: jest.fn(),
                write: jest.fn(),
                on: jest.fn()
            };

            sseService.addClient('client-1', 'event-123', mockResponse);

            expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
            expect(mockResponse.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
            expect(mockResponse.write).toHaveBeenCalled();
        });

        it('should handle client disconnect', () => {
            const mockResponse: any = {
                setHeader: jest.fn(),
                write: jest.fn(),
                on: jest.fn()
            };

            sseService.addClient('client-2', 'event-123', mockResponse);

            expect(mockResponse.on).toHaveBeenCalledWith('close', expect.any(Function));
        });
    });

    describe('sendToClient', () => {
        it('should send data to a specific client', () => {
            const mockResponse: any = {
                setHeader: jest.fn(),
                write: jest.fn(),
                on: jest.fn()
            };

            sseService.addClient('client-3', 'event-123', mockResponse);

            sseService.sendToClient('client-3', { type: 'test', data: 'hello' });

            expect(mockResponse.write).toHaveBeenCalledWith(
                expect.stringContaining('test')
            );
        });

        it('should handle errors when sending to client', () => {
            const mockResponse: any = {
                setHeader: jest.fn(),
                write: jest.fn().mockImplementation(() => {
                    throw new Error('Write error');
                }),
                on: jest.fn()
            };

            sseService.addClient('client-4', 'event-123', mockResponse);

            expect(() => sseService.sendToClient('client-4', { type: 'test' })).not.toThrow();
        });
    });

    describe('broadcastToEvent', () => {
        it('should broadcast message via Redis', async () => {
            (redisService.publish as jest.Mock).mockResolvedValue(1);

            await sseService.broadcastToEvent('event-123', { type: 'update' });

            expect(redisService.publish).toHaveBeenCalledWith(
                'event:event-123:updates',
                expect.any(String)
            );
        });

        it('should fallback to local broadcast if Redis fails', async () => {
            (redisService.publish as jest.Mock).mockRejectedValue(new Error('Redis error'));

            await expect(sseService.broadcastToEvent('event-123', { type: 'update' })).resolves.not.toThrow();
        });
    });

    describe('broadcastSeatUpdate', () => {
        it('should broadcast seat update to event', () => {
            (redisService.publish as jest.Mock).mockResolvedValue(1);

            sseService.broadcastSeatUpdate('event-123', [{ id: 'seat-1', status: 'booked' }]);

            expect(redisService.publish).toHaveBeenCalled();
        });
    });

    describe('getStats', () => {
        it('should return SSE service stats', () => {
            const stats = sseService.getStats();

            expect(stats).toHaveProperty('totalClients');
            expect(stats).toHaveProperty('eventChannels');
            expect(typeof stats.totalClients).toBe('number');
            expect(typeof stats.eventChannels).toBe('number');
        });
    });
});
