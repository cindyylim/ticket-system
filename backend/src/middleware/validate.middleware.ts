import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';

export const handleValidation = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0].msg });
        return;
    }
    next();
};

export const registerValidators = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
];

export const loginValidators = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
];

export const lockValidators = [
    body('eventId').isMongoId().withMessage('Event ID and seat IDs are required'),
    body('seatIds').isArray({ min: 1 }).withMessage('Event ID and seat IDs are required'),
    body('seatIds.*').isMongoId().withMessage('Each seat ID must be valid'),
];

export const confirmValidators = [
    body('eventId').isMongoId().withMessage('Event ID, seat IDs, and lock IDs are required'),
    body('seatIds').isArray({ min: 1 }).withMessage('Event ID, seat IDs, and lock IDs are required'),
    body('seatIds.*').isMongoId().withMessage('Each seat ID must be valid'),
    body('lockIds').custom((lockIds, { req }) => {
        if (!lockIds || typeof lockIds !== 'object' || Array.isArray(lockIds)) {
            throw new Error('Lock IDs must be an object with seat IDs as keys');
        }
        for (const seatId of req.body.seatIds || []) {
            if (!lockIds[seatId]) {
                throw new Error(`Missing lock ID for seat ${seatId}`);
            }
        }
        return true;
    }),
];

export const unlockValidators = [
    body('seatIds').isArray({ min: 1 }).withMessage('Seat IDs and lock IDs are required'),
    body('seatIds.*').isMongoId().withMessage('Each seat ID must be valid'),
    body('lockIds').custom((lockIds, { req }) => {
        if (!lockIds || typeof lockIds !== 'object' || Array.isArray(lockIds)) {
            throw new Error('Lock IDs must be an object with seat IDs as keys');
        }
        for (const seatId of req.body.seatIds || []) {
            if (!lockIds[seatId]) {
                throw new Error(`Missing lock ID for seat ${seatId}`);
            }
        }
        return true;
    }),
];

export const eventIdParamValidator = [
    param('eventId').isMongoId().withMessage('Valid event ID is required'),
];
