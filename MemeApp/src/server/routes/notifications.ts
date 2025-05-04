import express, { Response } from "express";
import type { AuthenticatedRequest } from '../../types/authenticated-request';
import { pool } from '../../config/database';

const router = express.Router();

router.get('/api', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

// Mark all as read
router.post('/mark-read', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.session.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await pool.query(
    `UPDATE notifications 
     SET is_read = true 
     WHERE user_id = $1`,
    [req.session.user.id]
  );

  res.json({ success: true });
});

// Delete a single notification
router.post('/delete-single', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.session.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { id } = req.body;
  await pool.query(
    `DELETE FROM notifications 
     WHERE id = $1 AND user_id = $2`,
    [id, req.session.user.id]
  );

  res.json({ success: true });
});

// Clear all notifications
router.post('/clear-all', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.session.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await pool.query(
    `DELETE FROM notifications WHERE user_id = $1`,
    [req.session.user.id]
  );

  res.json({ success: true });
});

export default router;
