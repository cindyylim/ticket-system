import mongoose from 'mongoose';
import { Seat } from '../../models/Seat';

describe('Seat Model', () => {
    const validSeatData = {
        eventId: new mongoose.Types.ObjectId(),
        section: 'VIP',
        row: 1,
        seatNumber: 1,
        price: 100,
        status: 'available'
    };

    it('should create a new seat successfully', async () => {
        const seat = new Seat(validSeatData);
        const savedSeat = await seat.save();

        expect(savedSeat._id).toBeDefined();
        expect(savedSeat.eventId).toEqual(validSeatData.eventId);
        expect(savedSeat.section).toBe(validSeatData.section);
        expect(savedSeat.row).toBe(validSeatData.row);
        expect(savedSeat.seatNumber).toBe(validSeatData.seatNumber);
        expect(savedSeat.price).toBe(validSeatData.price);
        expect(savedSeat.status).toBe('available');
    });

    it('should fail if required fields are missing', async () => {
        const fieldsToTest = ['eventId', 'section', 'row', 'seatNumber', 'price'];
        for (const field of fieldsToTest) {
            const invalidData = { ...validSeatData, [field]: undefined };
            const seat = new Seat(invalidData);
            await expect(seat.save()).rejects.toThrow();
        }
    });

    it('should fail if status is invalid', async () => {
        const invalidSeat = new Seat({ ...validSeatData, status: 'invalid' });
        await expect(invalidSeat.save()).rejects.toThrow();
    });

    it('should enforce unique index for event/section/row/seatNumber', async () => {
        const uniqueEventId = new mongoose.Types.ObjectId();
        const seatData = { ...validSeatData, eventId: uniqueEventId };

        await Seat.syncIndexes();
        await new Seat(seatData).save();

        const duplicateSeat = new Seat(seatData);
        let error: any;
        try {
            await duplicateSeat.save();
        } catch (err) {
            error = err;
        }

        expect(error).toBeDefined();
        expect(error.code).toBe(11000);
    });
});
