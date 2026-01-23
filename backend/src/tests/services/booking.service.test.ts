import mongoose from 'mongoose';
import { bookingService } from '../../services/booking.service';
import { Seat } from '../../models/Seat';
import { Booking } from '../../models/Booking';
import { lockService } from '../../services/lock.service';
import { sseService } from '../../services/sse.service';

jest.mock('../../services/lock.service');
jest.mock('../../services/sse.service');
jest.mock('../../services/queue.service');

describe('BookingService', () => {
    let eventId: mongoose.Types.ObjectId;
    let seatId: mongoose.Types.ObjectId;
    let userId: string;

    beforeEach(async () => {
        eventId = new mongoose.Types.ObjectId();
        seatId = new mongoose.Types.ObjectId();
        userId = new mongoose.Types.ObjectId().toString();

        // Create test seat
        await Seat.create({
            _id: seatId,
            eventId,
            section: 'VIP',
            row: 1,
            seatNumber: 1,
            price: 100,
            status: 'available'
        });
    });

    describe('lockSeats', () => {
        it('should lock seats successfully', async () => {
            (lockService.acquireLock as jest.Mock).mockResolvedValue({
                acquired: true,
                lockId: 'lock-123'
            });
            (sseService.broadcastSeatUpdate as jest.Mock).mockResolvedValue(undefined);

            const result = await bookingService.lockSeats(
                eventId.toString(),
                [seatId.toString()],
                userId
            );

            expect(result.success).toBe(true);
            expect(result.lockIds).toBeDefined();
            expect(result.lockIds![seatId.toString()]).toBe('lock-123');
            expect((await Seat.findById(seatId))!.status).toBe('locked')
        });

        it('should fail if seats do not exist', async () => {
            const result = await bookingService.lockSeats(
                eventId.toString(),
                [new mongoose.Types.ObjectId().toString()],
                userId
            );

            expect(result.success).toBe(false);
            expect(result.message).toContain('do not exist');
        });

        it('should fail if seats are not available', async () => {
            await Seat.updateOne({ _id: seatId }, { status: 'booked' });

            const result = await bookingService.lockSeats(
                eventId.toString(),
                [seatId.toString()],
                userId
            );

            expect(result.success).toBe(false);
            expect(result.message).toContain('no longer available');
        });

        it('should rollback if lock acquisition fails', async () => {
            const seat2Id = new mongoose.Types.ObjectId();
            await Seat.create({
                _id: seat2Id,
                eventId,
                section: 'VIP',
                row: 1,
                seatNumber: 2,
                price: 100,
                status: 'available'
            });

            (lockService.acquireLock as jest.Mock)
                .mockResolvedValueOnce({ acquired: true, lockId: 'lock-1' })
                .mockResolvedValueOnce({ acquired: false });
            (lockService.releaseLock as jest.Mock).mockResolvedValue(true);

            const result = await bookingService.lockSeats(
                eventId.toString(),
                [seatId.toString(), seat2Id.toString()],
                userId
            );

            expect(result.success).toBe(false);
            expect(lockService.releaseLock).toHaveBeenCalled();
        });
    });

    describe('confirmBooking', () => {
        it('should confirm booking successfully', async () => {
            await Seat.updateOne({ _id: seatId }, {
                status: 'locked',
                lockedBy: new mongoose.Types.ObjectId(userId),
                lockedAt: new Date()
            });

            (lockService.getLockInfo as jest.Mock).mockResolvedValue({
                lockId: 'lock-123',
                userId,
                acquiredAt: Date.now()
            });
            (lockService.releaseLock as jest.Mock).mockResolvedValue(true);
            (sseService.broadcastSeatUpdate as jest.Mock).mockResolvedValue(undefined);

            const result = await bookingService.confirmBooking(
                eventId.toString(),
                [seatId.toString()],
                userId,
                { [seatId.toString()]: 'lock-123' }
            );

            expect(result.success).toBe(true);
            expect(result.bookingId).toBeDefined();

            const booking = await Booking.findById(result.bookingId);
            expect(booking).toBeDefined();
            expect(booking!.status).toBe('confirmed');
            expect((await Seat.findById(seatId))!.status).toBe('booked');
            expect(lockService.releaseLock).toHaveBeenCalledWith(`seats:${seatId.toString()}`, 'lock-123')
        });

        it('should fail if lock is invalid', async () => {
            (lockService.getLockInfo as jest.Mock).mockResolvedValue(null);

            const result = await bookingService.confirmBooking(
                eventId.toString(),
                [seatId.toString()],
                userId,
                { [seatId.toString()]: 'invalid-lock' }
            );

            expect(result.success).toBe(false);
            expect(result.message).toContain('expired or invalid');
        });
    });

    describe('unlockSeats', () => {
        it('should unlock seats successfully', async () => {
            await Seat.updateOne({ _id: seatId }, {
                status: 'locked',
                lockedBy: new mongoose.Types.ObjectId(userId),
                lockedAt: new Date()
            });

            (lockService.releaseLock as jest.Mock).mockResolvedValue(true);
            (sseService.broadcastSeatUpdate as jest.Mock).mockResolvedValue(undefined);

            const result = await bookingService.unlockSeats(
                [seatId.toString()],
                userId,
                { [seatId.toString()]: 'lock-123' }
            );

            expect(result.success).toBe(true);

            const seat = await Seat.findById(seatId);
            expect(seat!.status).toBe('available');
            expect(lockService.releaseLock).toHaveBeenCalledWith(`seats:${seatId.toString()}`, 'lock-123')
        });
    });

    describe('cleanupExpiredLocks', () => {
        it('should clean up expired locks', async () => {
            await Seat.updateOne({ _id: seatId }, {
                status: 'locked',
                lockedBy: new mongoose.Types.ObjectId(userId),
                lockedAt: new Date(Date.now() - 700000)
            });

            (lockService.isLocked as jest.Mock).mockResolvedValue(true);
            (lockService.releaseLock as jest.Mock).mockResolvedValue(true);
            (lockService.getLockTTL as jest.Mock).mockReturnValue(600);
            (lockService.getLockKey as jest.Mock).mockReturnValue(`lock:seats:${seatId}`);
            (sseService.broadcastSeatUpdate as jest.Mock).mockResolvedValue(undefined);

            await bookingService.cleanupExpiredLocks();

            const seat = await Seat.findById(seatId);
            expect(seat!.status).toBe('available');
            expect(lockService.releaseLock).toHaveBeenCalledWith(`seats:${seatId.toString()}`, `lock:seats:${seatId}`)
        });

        it('should clean up expired locks when redis lock is not found', async () => {
            await Seat.updateOne({ _id: seatId }, {
                status: 'locked',
                lockedBy: new mongoose.Types.ObjectId(userId),
                lockedAt: new Date(Date.now() - 700000)
            });

            (lockService.isLocked as jest.Mock).mockResolvedValue(false);
            (sseService.broadcastSeatUpdate as jest.Mock).mockResolvedValue(undefined);

            await bookingService.cleanupExpiredLocks();

            const seat = await Seat.findById(seatId);
            expect(seat!.status).toBe('available');
        });

        it('should not clean up valid locks', async () => {
            await Seat.updateOne({ _id: seatId }, {
                status: 'locked',
                lockedBy: new mongoose.Types.ObjectId(userId),
                lockedAt: new Date()
            });

            (lockService.isLocked as jest.Mock).mockResolvedValue(true);

            await bookingService.cleanupExpiredLocks();

            const seat = await Seat.findById(seatId);
            expect(seat!.status).toBe('locked');
        });
    });

    describe('Error Handling', () => {
        it('should handle errors in lockSeats', async () => {
            const findSpy = jest.spyOn(Seat, 'find').mockRejectedValueOnce(new Error('DB Error'));

            const result = await bookingService.lockSeats(
                eventId.toString(),
                [seatId.toString()],
                userId
            );

            expect(result.success).toBe(false);
            expect(result.message).toBe('Failed to lock seats');
            findSpy.mockRestore();
        });

        it('should handle errors in confirmBooking', async () => {
            (lockService.getLockInfo as jest.Mock).mockRejectedValueOnce(new Error('Redis Error'));

            const result = await bookingService.confirmBooking(
                eventId.toString(),
                [seatId.toString()],
                userId,
                { [seatId.toString()]: 'lock-123' }
            );

            expect(result.success).toBe(false);
            expect(result.message).toBe('Failed to confirm booking');
        });

        it('should handle errors in unlockSeats', async () => {
            const updateSpy = jest.spyOn(Seat, 'updateMany').mockRejectedValueOnce(new Error('DB Error'));

            const result = await bookingService.unlockSeats(
                [seatId.toString()],
                userId,
                { [seatId.toString()]: 'lock-123' }
            );

            expect(result.success).toBe(false);
            expect(result.message).toBe('Failed to unlock seats');
            updateSpy.mockRestore();
        });

        it('should handle errors in cleanupExpiredLocks', async () => {
            const findSpy = jest.spyOn(Seat, 'find').mockRejectedValueOnce(new Error('DB Error'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await bookingService.cleanupExpiredLocks();

            expect(consoleSpy).toHaveBeenCalledWith('Error cleaning up expired locks:', expect.any(Error));
            consoleSpy.mockRestore();
            findSpy.mockRestore();
        });

        it('should handle empty locked seats in cleanupExpiredLocks', async () => {
            const findSpy = jest.spyOn(Seat, 'find').mockResolvedValueOnce([]);
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await bookingService.cleanupExpiredLocks();

            expect(consoleSpy).toHaveBeenCalledWith('🧹 No locked seats found during cleanup');
            consoleSpy.mockRestore();
            findSpy.mockRestore();
        });
    });
});
