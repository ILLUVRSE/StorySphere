import express from 'express';
import { register, login, me } from './controllers/auth';
import { createTeam, getTeam, updateTeam, updateSkillAllocation } from './controllers/teams';
import { createPlayer, getPlayer } from './controllers/players';
import { createSeason, advanceWeek } from './controllers/seasons';
import { completeMatch } from './controllers/points';
import { getMatchEvents } from './controllers/matches';
import { authMiddleware } from './middlewares/auth';

const router = express.Router();

// Auth
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', authMiddleware, me);

// Teams
router.post('/teams', authMiddleware, createTeam);
router.get('/teams/:id', authMiddleware, getTeam);
router.put('/teams/:id', authMiddleware, updateTeam);
router.put('/teams/:id/skill-allocation', authMiddleware, updateSkillAllocation);

// Players
// Note: RESTful design often puts create player under team
router.post('/teams/:teamId/players', authMiddleware, createPlayer);
router.get('/players/:id', authMiddleware, getPlayer);

// Seasons
router.post('/seasons', authMiddleware, createSeason);
router.post('/seasons/:id/advance', authMiddleware, advanceWeek);

// Points / Match Completion
// Only admin or system should call this, but for MVP we use authMiddleware
router.post('/matches/:matchId/complete', authMiddleware, completeMatch);
router.get('/matches/:id/events', authMiddleware, getMatchEvents);

export default router;
