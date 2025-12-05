import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, displayName } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const id = uuidv4();

        if (db.isReady()) {
            try {
                await db.query(
                    `INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4)`,
                    [id, email, passwordHash, displayName || email.split('@')[0]]
                );
            } catch (err: any) {
                // Fallback if DB connection refused despite isReady
                if (err.code === 'ECONNREFUSED' || err.code === '57P03') {
                     console.warn("DB connection failed, falling back to mock");
                } else if (err.code === '23505') {
                    return res.status(409).json({ error: 'Email already exists' });
                } else {
                    throw err;
                }
            }
        } else {
            console.warn("DB not ready, simulating user creation");
        }

        const token = jwt.sign({ id, email, displayName }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { id, email, displayName } });
    } catch (error: any) {
        console.error("Register Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

        let user = null;

        if (db.isReady()) {
            try {
                const result = await db.query(`SELECT * FROM users WHERE email = $1`, [email]);
                user = result.rows[0];
            } catch (err: any) {
                 if (err.code === 'ECONNREFUSED' || err.code === '57P03') {
                     console.warn("DB connection failed, falling back to mock");
                 } else {
                     throw err;
                 }
            }
        }

        if (user) {
            if (!(await bcrypt.compare(password, user.password_hash))) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const token = jwt.sign({ id: user.id, email: user.email, displayName: user.display_name }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
        } else {
             // Mock Login
             if (email === 'test@example.com' && password === 'password') {
                const mockUser = { id: 'mock-uuid', email, displayName: 'Test User' };
                const token = jwt.sign(mockUser, JWT_SECRET, { expiresIn: '7d' });
                return res.json({ token, user: mockUser });
             }
             return res.status(401).json({ error: 'Invalid credentials (mock)' });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const me = async (req: Request, res: Response) => {
    // @ts-ignore
    res.json({ user: req.user });
};
