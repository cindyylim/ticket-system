import { Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import jwt from 'jsonwebtoken';

describe('Auth Middleware', () => {
    let mockRequest: Partial<AuthRequest>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
        mockRequest = {
            header: jest.fn()
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        nextFunction = jest.fn();
    });

    it('should authenticate with valid token', () => {
        const userId = 'user-123';
        const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'your-super-secret-jwt-key');

        (mockRequest.header as jest.Mock).mockReturnValue(`Bearer ${token}`);

        authMiddleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

        expect(mockRequest.userId).toBe(userId);
        expect(nextFunction).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request without token', () => {
        (mockRequest.header as jest.Mock).mockReturnValue(undefined);

        authMiddleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', () => {
        (mockRequest.header as jest.Mock).mockReturnValue('Bearer invalid-token');

        authMiddleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with expired token', () => {
        const userId = 'user-123';
        const token = jwt.sign(
            { userId },
            process.env.JWT_SECRET || 'your-super-secret-jwt-key',
            { expiresIn: '-1h' } // Expired 1 hour ago
        );

        (mockRequest.header as jest.Mock).mockReturnValue(`Bearer ${token}`);

        authMiddleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
        expect(nextFunction).not.toHaveBeenCalled();
    });
});
