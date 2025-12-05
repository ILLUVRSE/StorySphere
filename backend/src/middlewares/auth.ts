import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DEV_AUTH = process.env.DEV_AUTH === 'true';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // Dev Override
    const devUserId = req.headers['x-user-id'];
    if (DEV_AUTH && devUserId) {
        // @ts-ignore
        req.user = { id: devUserId, email: 'dev@local', displayName: 'Dev User' };
        return next();
    }

    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // @ts-ignore
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
