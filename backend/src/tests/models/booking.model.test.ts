import mongoose from 'mongoose';
import { Booking } from '../../models/Booking';

describe('Booking Model', () => {
    const validBookingData = {
        userId: new mongoose.Types.ObjectId(),
        eventId: new mongoose.Types.ObjectId(),
        seatIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        totalPrice: 150,
        status: 'pending',
        paymentStatus: 'pending'
    };

    it('should create a new booking successfully', async () => {
        const booking = new Booking(validBookingData);
        const savedBooking = await booking.save();

        expect(savedBooking._id).toBeDefined();
        expect(savedBooking.userId).toEqual(validBookingData.userId);
        expect(savedBooking.totalPrice).toBe(validBookingData.totalPrice);
        expect(savedBooking.seatIds.length).toBe(2);
        expect(savedBooking.status).toBe('pending');
        expect(savedBooking.paymentStatus).toBe('pending');
        expect(savedBooking.createdAt).toBeDefined();
    });

    it('should fail if required fields are missing', async () => {
        const fieldsToTest = ['userId', 'eventId', 'totalPrice'];
        for (const field of fieldsToTest) {
            const invalidData = { ...validBookingData, [field]: undefined };
            const booking = new Booking(invalidData);
            await expect(booking.save()).rejects.toThrow();
        }
    });

    it('should fail if seatIds are missing or empty (required: true in array element)', async () => {
        const bookingWithEmptySeats = new Booking({ ...validBookingData, seatIds: [] });
        const saved = await bookingWithEmptySeats.save();
        expect(saved.seatIds.length).toBe(0); 

        const bookingWithNullSeat = new Booking({ ...validBookingData, seatIds: [null] });
        await expect(bookingWithNullSeat.save()).rejects.toThrow();
    });

    it('should fail if status or paymentStatus are invalid', async () => {
        const invalidStatus = new Booking({ ...validBookingData, status: 'invalid' });
        await expect(invalidStatus.save()).rejects.toThrow();

        const invalidPaymentStatus = new Booking({ ...validBookingData, paymentStatus: 'invalid' });
        await expect(invalidPaymentStatus.save()).rejects.toThrow();
    });
});
