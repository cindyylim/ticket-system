import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBooking extends Document {
    userId: Types.ObjectId;
    eventId: Types.ObjectId;
    seatIds: Types.ObjectId[];
    totalPrice: number;
    status: 'pending' | 'confirmed' | 'cancelled';
    paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
    createdAt: Date;
    confirmedAt?: Date;
}

const bookingSchema = new Schema<IBooking>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    eventId: {
        type: Schema.Types.ObjectId,
        ref: 'Event',
        required: true,
    },
    seatIds: [{
        type: Schema.Types.ObjectId,
        ref: 'Seat',
        required: true,
    }],
    totalPrice: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled'],
        default: 'pending',
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    confirmedAt: {
        type: Date,
    },
});

// Index for user booking lookup
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ eventId: 1 });

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema);
