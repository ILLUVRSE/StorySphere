import express from 'express';
import { register, login, me } from './controllers/auth';
import { createTeam, getTeam, updateSkillAllocation } from './controllers/teams';
import { createPlayer, getPlayer } from './controllers/players';
import { createSeason } from './controllers/seasons';
import { completeMatch } from './controllers/points';
import { authMiddleware } from './middlewares/auth';

const router = express.Router();

// Auth
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', authMiddleware, me);

// Teams
router.post('/teams', authMiddleware, createTeam);
router.get('/teams/:id', authMiddleware, getTeam);
router.put('/teams/:id/skill-allocation', authMiddleware, updateSkillAllocation);

// Players
// Note: RESTful design often puts create player under team
router.post('/teams/:teamId/players', authMiddleware, createPlayer);
router.get('/players/:id', authMiddleware, getPlayer);

// Seasons
router.post('/seasons', authMiddleware, createSeason);

// Points / Match Completion
// Only admin or system should call this, but for MVP we use authMiddleware
router.post('/matches/:matchId/complete', authMiddleware, completeMatch);

export default router;
