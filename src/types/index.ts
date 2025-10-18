import { Request, Response, NextFunction } from 'express';

export interface CustomRequest extends Request {
    user?: any; // Extend with user type if needed
}

export interface ErrorResponse {
    status: number;
    message: string;
}

export interface MiddlewareFunction {
    (req: CustomRequest, res: Response, next: NextFunction): void;
}