import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/auth';

export interface AuthRequest extends Request {
    userId?: string;
}

export const authMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };

        req.userId = decoded.userId;
        next();
    } catch (error) {
        if (error instanceof Error && error.message === 'JWT_SECRET is required') {
            res.status(500).json({ error: 'Server misconfigured' });
            return;
        }
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

