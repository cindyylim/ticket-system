import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
    err: Error,
    _: Request,
    res: Response,
    __: NextFunction
): void => {
    console.error('Error:', err);

    res.status(500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'An error occurred'
            : err.message,
    });
};
