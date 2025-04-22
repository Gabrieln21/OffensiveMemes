// routes/notifications.ts or wherever you keep profile/game-related API stuff
import express, { Request, Response } from "express";
import type { AuthenticatedRequest } from '../../types/authenticated-request';
import { pool } from '../../config/database';

const router = express.Router();

router.get('/api', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.session.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Not logged in' });
        return;
    }

  try {
    const { rows } = await pool.query(`
      SELECT 
        n.id, 
        n.type, 
        n.message, 
        n.is_read, 
        n.created_at,
        n.from_user_id,
        u.username AS from_username
      FROM notifications n
      LEFT JOIN users u ON n.from_user_id = u.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 20
    `, [userId]);

    res.json({ notifications: rows });
  } catch (err) {
    console.error('❌ Failed to load notifications:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/mark-read', async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.session.user?.id;
    if (!userId) { 
        res.status(401).json({ error: 'Not logged in' });
        return;
    }
  
    try {
      await pool.query(`
        UPDATE notifications
        SET is_read = true
        WHERE user_id = $1 AND is_read = false
      `, [userId]);
  
      res.sendStatus(200);
    } catch (err) {
      console.error('❌ Failed to mark notifications as read:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
export default router;
