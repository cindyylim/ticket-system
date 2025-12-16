import mongoose, { Document, Schema, Types } from 'mongoose';

export type SeatStatus = 'available' | 'locked' | 'booked';

export interface ISeat extends Document {
    eventId: Types.ObjectId;
    section: string;
    row: number;
    seatNumber: number;
    price: number;
    status: SeatStatus;
    lockedBy?: Types.ObjectId;
    lockedAt?: Date;
    bookedBy?: Types.ObjectId;
    bookedAt?: Date;
}

const seatSchema = new Schema<ISeat>({
    eventId: {
        type: Schema.Types.ObjectId,
        ref: 'Event',
        required: true,
    },
    section: {
        type: String,
        required: true,
    },
    row: {
        type: Number,
        required: true,
    },
    seatNumber: {
        type: Number,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['available', 'locked', 'booked'],
        default: 'available',
    },
    lockedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    lockedAt: {
        type: Date,
    },
    bookedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    bookedAt: {
        type: Date,
    },
});

// Compound indexes for efficient queries
seatSchema.index({ eventId: 1, status: 1 });
seatSchema.index({ eventId: 1, section: 1, row: 1, seatNumber: 1 }, { unique: true });
seatSchema.index({ lockedBy: 1, lockedAt: 1 });

export const Seat = mongoose.model<ISeat>('Seat', seatSchema);
