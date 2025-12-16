import mongoose, { Document, Schema } from 'mongoose';

export interface IVenue extends Document {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    capacity: number;
    sections: {
        name: string;
        rows: number;
        seatsPerRow: number;
    }[];
    imageUrl: string;
    description: string;
}

const venueSchema = new Schema<IVenue>({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    address: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        required: true,
    },
    zipCode: {
        type: String,
        required: true,
    },
    capacity: {
        type: Number,
        required: true,
    },
    sections: [{
        name: { type: String, required: true },
        rows: { type: Number, required: true },
        seatsPerRow: { type: Number, required: true },
    }],
    imageUrl: {
        type: String,
        default: '',
    },
    description: {
        type: String,
        default: '',
    },
});

// Index for city/state searches
venueSchema.index({ city: 1, state: 1 });

export const Venue = mongoose.model<IVenue>('Venue', venueSchema);
