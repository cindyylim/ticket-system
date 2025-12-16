import mongoose, { Document, Schema } from 'mongoose';

export interface IPerformer extends Document {
    name: string;
    genre: string;
    imageUrl: string;
    bio: string;
}

const performerSchema = new Schema<IPerformer>({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    genre: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
        default: '',
    },
    bio: {
        type: String,
        default: '',
    },
});

// Index for genre filtering
performerSchema.index({ genre: 1 });

export const Performer = mongoose.model<IPerformer>('Performer', performerSchema);
