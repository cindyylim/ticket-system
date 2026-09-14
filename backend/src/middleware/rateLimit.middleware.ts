import rateLimit from 'express-rate-limit';

const skipInTests = (): boolean => process.env.NODE_ENV === 'test';

export const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTests,
    message: { error: 'Too many attempts, try again later' },
});

export const lockRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTests,
    message: { error: 'Too many booking attempts, slow down' },
});
