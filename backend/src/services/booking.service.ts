import { Seat } from '../models/Seat';
import { Booking } from '../models/Booking';
import { lockService } from './lock.service';
import { sseService } from './sse.service';
import { queueService } from './queue.service';
import { Types } from 'mongoose';

class BookingService {
    // Lock seats for booking (with distributed lock)
    async lockSeats(
        eventId: string,
        seatIds: string[],
        userId: string
    ): Promise<{ success: boolean; message: string; lockIds?: { [seatId: string]: string } }> {
        try {
            const objectIdSeats = seatIds.map(id => new Types.ObjectId(id));
            const seats = await Seat.find({
                _id: { $in: objectIdSeats },
                eventId: new Types.ObjectId(eventId),
            });

            // Validate seats exist
            if (seats.length !== seatIds.length) {
                return { success: false, message: 'Some seats do not exist' };
            }

            // Check if all are available
            const unavailableSeats = seats.filter(seat => seat.status !== 'available');
            if (unavailableSeats.length > 0) {
                return { success: false, message: 'Some seats are no longer available' };
            }

            const acquiredLocks: { [seatId: string]: string } = {};
            const failedSeats: string[] = [];

            // Try to acquire lock for each seat individually
            for (const seatId of seatIds) {
                const lockResource = `seats:${seatId}`;
                const lockResult = await lockService.acquireLock(lockResource, userId);

                if (lockResult.acquired && lockResult.lockId) {
                    acquiredLocks[seatId] = lockResult.lockId;
                } else {
                    failedSeats.push(seatId);
                    break; // If any seat fails, we need to rollback
                }
            }

            // If we failed to acquire all locks, release the ones we got
            if (failedSeats.length > 0) {
                // Release acquired locks
                for (const [seatId, lockId] of Object.entries(acquiredLocks)) {
                    const lockResource = `seats:${seatId}`;
                    await lockService.releaseLock(lockResource, lockId);
                }
                return {
                    success: false,
                    message: `Unable to lock seats: ${failedSeats.join(', ')}. Please try again.`,
                };
            }

            // Update all seats to locked status
            await Seat.updateMany(
                { _id: { $in: objectIdSeats } },
                {
                    $set: {
                        status: 'locked',
                        lockedBy: new Types.ObjectId(userId),
                        lockedAt: new Date(),
                    },
                }
            );

            console.log(`🎫 Seats locked for user ${userId}: ${seatIds.join(', ')}`);

            // Broadcast seat update via SSE
            const updatedSeats = await Seat.find({ _id: { $in: objectIdSeats } });
            sseService.broadcastSeatUpdate(eventId, updatedSeats);

            return {
                success: true,
                message: 'Seats locked successfully',
                lockIds: acquiredLocks,
            };
        } catch (error) {
            console.error('Error locking seats:', error);
            return { success: false, message: 'Failed to lock seats' };
        }
    }

    // Confirm booking (finalize after payment)
    async confirmBooking(
        eventId: string,
        seatIds: string[],
        userId: string,
        lockIds: { [seatId: string]: string }
    ): Promise<{ success: boolean; message: string; bookingId?: string }> {
        try {
            const objectIdSeats = seatIds.map(id => new Types.ObjectId(id));

            // Verify all locks are still held
            for (const [seatId, lockId] of Object.entries(lockIds)) {
                const lockResource = `seats:${seatId}`;
                const lockInfo = await lockService.getLockInfo(lockResource);
                if (!lockInfo || lockInfo.lockId !== lockId || lockInfo.userId !== userId) {
                    return { success: false, message: `Lock for seat ${seatId} expired or invalid` };
                }
            }

            // Get seats to calculate total price
            const seats = await Seat.find({ _id: { $in: objectIdSeats } });
            const totalPrice = seats.reduce((sum, seat) => sum + seat.price, 0);

            // Update seats to booked
            await Seat.updateMany(
                { _id: { $in: objectIdSeats } },
                {
                    $set: {
                        status: 'booked',
                        bookedBy: new Types.ObjectId(userId),
                        bookedAt: new Date(),
                    },
                    $unset: { lockedBy: '', lockedAt: '' },
                }
            );

            // Create booking record
            const booking = await Booking.create({
                userId: new Types.ObjectId(userId),
                eventId: new Types.ObjectId(eventId),
                seatIds: objectIdSeats,
                totalPrice,
                status: 'confirmed',
                paymentStatus: 'completed',
                confirmedAt: new Date(),
            });

            // Release all distributed locks
            for (const [seatId, lockId] of Object.entries(lockIds)) {
                const lockResource = `seats:${seatId}`;
                await lockService.releaseLock(lockResource, lockId);
            }

            console.log(`✅ Booking confirmed for user ${userId}: ${booking._id}`);

            // Broadcast update via SSE
            const updatedSeats = await Seat.find({ _id: { $in: objectIdSeats } });
            sseService.broadcastSeatUpdate(eventId, updatedSeats);

            return {
                success: true,
                message: 'Booking confirmed successfully',
                bookingId: booking._id.toString(),
            };
        } catch (error) {
            console.error('Error confirming booking:', error);
            return { success: false, message: 'Failed to confirm booking' };
        }
    }

    // Cancel/unlock seats
    async unlockSeats(
        seatIds: string[],
        userId: string,
        lockIds: { [seatId: string]: string }
    ): Promise<{ success: boolean; message: string }> {
        try {
            const objectIdSeats = seatIds.map(id => new Types.ObjectId(id));

            // Get event ID from first seat for SSE broadcast
            const firstSeat = await Seat.findById(objectIdSeats[0]);
            const eventId = firstSeat?.eventId.toString();

            // Release seats
            await Seat.updateMany(
                { _id: { $in: objectIdSeats }, lockedBy: new Types.ObjectId(userId) },
                {
                    $set: { status: 'available' },
                    $unset: { lockedBy: '', lockedAt: '' },
                }
            );

            // Release all locks
            for (const [seatId, lockId] of Object.entries(lockIds)) {
                const lockResource = `seats:${seatId}`;
                await lockService.releaseLock(lockResource, lockId);
            }

            console.log(`🔓 Seats unlocked for user ${userId}`);

            // Broadcast update via SSE if we found event ID
            if (eventId) {
                const updatedSeats = await Seat.find({ _id: { $in: objectIdSeats } });
                sseService.broadcastSeatUpdate(eventId, updatedSeats);
            }

            return { success: true, message: 'Seats unlocked successfully' };
        } catch (error) {
            console.error('Error unlocking seats:', error);
            return { success: false, message: 'Failed to unlock seats' };
        }
    }

    // Clean up expired locks (run periodically)
    async cleanupExpiredLocks(): Promise<void> {
        try {
            // Find all seats that are currently locked
            const lockedSeats = await Seat.find({
                status: 'locked',
            });

            if (lockedSeats.length === 0) {
                console.log('🧹 No locked seats found during cleanup');
                return;
            }

            // Track seats to release along with their user and event info
            const seatsToRelease: Array<{ seatId: Types.ObjectId; userId: string; eventId: string }> = [];
            const lockTTL = lockService.getLockTTL() * 1000; // Convert to milliseconds

            // Check each locked seat
            for (const seat of lockedSeats) {
                const lockResource = `seats:${seat._id}`;

                // Check if the Redis lock still exists
                const isLocked = await lockService.isLocked(lockResource);

                // If Redis lock doesn't exist or has expired, release the seat
                if (!isLocked) {
                    seatsToRelease.push({
                        seatId: seat._id,
                        userId: seat.lockedBy?.toString() || '',
                        eventId: seat.eventId.toString(),
                    });
                    console.log(`🔓 Releasing seat ${seat._id} - Redis lock expired`);
                }
                // Also check if the seat has been locked for longer than the TTL
                else if (seat.lockedAt && (Date.now() - seat.lockedAt.getTime()) > lockTTL) {
                    seatsToRelease.push({
                        seatId: seat._id,
                        userId: seat.lockedBy?.toString() || '',
                        eventId: seat.eventId.toString(),
                    });
                    console.log(`🔓 Releasing seat ${seat._id} - Lock TTL exceeded`);
                }
            }

            if (seatsToRelease.length === 0) {
                console.log('🧹 No expired locks to clean up');
                return;
            }

            // Extract seat IDs for database update
            const seatIds = seatsToRelease.map(s => s.seatId);

            // Release expired seats
            await Seat.updateMany(
                { _id: { $in: seatIds } },
                {
                    $set: { status: 'available' },
                    $unset: { lockedBy: '', lockedAt: '' },
                }
            );

            console.log(`🧹 Cleaned up ${seatsToRelease.length} expired seat locks`);

            // Remove users from queue (group by event and user to avoid duplicates)
            const usersByEvent = new Map<string, Set<string>>();
            for (const { eventId, userId } of seatsToRelease) {
                if (userId) {
                    if (!usersByEvent.has(eventId)) {
                        usersByEvent.set(eventId, new Set());
                    }
                    usersByEvent.get(eventId)!.add(userId);
                }
            }

            // Remove each user from their respective event queue
            for (const [eventId, userIds] of usersByEvent) {
                for (const userId of userIds) {
                    queueService.removeFromQueue(eventId, userId);
                    console.log(`📋 Removed user ${userId} from queue for event ${eventId} due to expired lock`);
                }
            }

            // Get the updated seats for broadcasting
            const updatedSeats = await Seat.find({ _id: { $in: seatIds } });

            // Broadcast updates grouped by event
            const eventGroups = new Map<string, typeof updatedSeats>();
            for (const seat of updatedSeats) {
                const eventId = seat.eventId.toString();
                if (!eventGroups.has(eventId)) {
                    eventGroups.set(eventId, []);
                }
                eventGroups.get(eventId)!.push(seat);
            }

            for (const [eventId, seats] of eventGroups) {
                sseService.broadcastSeatUpdate(eventId, seats);
            }
        } catch (error) {
            console.error('Error cleaning up expired locks:', error);
        }
    }
}

export const bookingService = new BookingService();
