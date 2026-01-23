import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../middleware/error.middleware';

describe('Error Middleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
        mockRequest = {};
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        nextFunction = jest.fn();

        // Suppress console.error during tests
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should handle errors in production mode', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const error = new Error('Test error');
        errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'An error occurred' });
        expect(console.error).toHaveBeenCalledWith('Error:', error);

        process.env.NODE_ENV = originalEnv;
    });

    it('should handle errors in development mode', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const error = new Error('Test error message');
        errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Test error message' });
        expect(console.error).toHaveBeenCalledWith('Error:', error);

        process.env.NODE_ENV = originalEnv;
    });

    it('should log error to console', () => {
        const error = new Error('Test error');
        errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

        expect(console.error).toHaveBeenCalledWith('Error:', error);
    });
});
