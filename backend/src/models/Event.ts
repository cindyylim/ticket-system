import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IEvent extends Document {
    title: string;
    performerId: Types.ObjectId;
    venueId: Types.ObjectId;
    date: Date;
    description: string;
    imageUrl: string;
    category: string;
    status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
    priceTiers: {
        section: string;
        price: number;
    }[];
}

const eventSchema = new Schema<IEvent>({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    performerId: {
        type: Schema.Types.ObjectId,
        ref: 'Performer',
        required: true,
    },
    venueId: {
        type: Schema.Types.ObjectId,
        ref: 'Venue',
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    description: {
        type: String,
        default: '',
    },
    imageUrl: {
        type: String,
        default: '',
    },
    category: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
        default: 'upcoming',
    },
    priceTiers: [{
        section: { type: String, required: true },
        price: { type: Number, required: true },
    }],
});

// Compound index for filtering by date and status
eventSchema.index({ date: 1, status: 1 });
eventSchema.index({ category: 1, status: 1 });

export const Event = mongoose.model<IEvent>('Event', eventSchema);
