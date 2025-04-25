// src/routes/friends.ts

import express, { Request, Response } from "express";
import type { AuthenticatedRequest } from '../../types/authenticated-request';

import { pool } from '../../config/database';

const router = express.Router();

// Send a friend request
router.post('/request', async (req: AuthenticatedRequest, res: Response) => {
    const { receiverId } = req.body;
    const senderId = req.session.user?.id;
    if (!senderId || !receiverId) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }
    if (senderId === receiverId) {
      res.status(400).json({ error: 'You can’t friend yourself 😭' });
      return;
    }

    try {
      await pool.query(
        `INSERT INTO friendships (user_id_1, user_id_2, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT DO NOTHING`,
        [senderId, receiverId]
      );
  
      // 🔔 Notify receiver
      const sender = await pool.query(`SELECT username FROM users WHERE id = $1`, [senderId]);
      const senderUsername = sender.rows[0]?.username || 'Someone';
  
      await pool.query(
        `INSERT INTO notifications (user_id, from_user_id, type, message)
         VALUES ($1, $2, 'friend_request', $3)`,
        [receiverId, senderId, `${senderUsername} sent you a friend request!`]
      );
  
      res.redirect("/friends/page");
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  

// Accept a friend request
// Accept friend request
router.post('/accept', async (req: AuthenticatedRequest, res: Response) => {
    const { senderId } = req.body;
    const receiverId = req.session.user?.id;
  
    if (!senderId || !receiverId) {
        res.status(400).json({ error: 'Missing fields' });
        return;
    }
  
    try {
      await pool.query(
        `UPDATE friendships
         SET status = 'accepted'
         WHERE user_id_1 = $1 AND user_id_2 = $2 AND status = 'pending'`,
        [senderId, receiverId]
      );
      res.redirect("/friends/page");
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  
  // Remove any friend (redundant with /remove-friend but kept for completeness)
  router.post('/remove', async (req: AuthenticatedRequest, res: Response) => {
    const { friendId } = req.body;
    const userId = req.session.user?.id;
  
    if (!userId || !friendId) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }
  
    try {
      await pool.query(
        `DELETE FROM friendships
         WHERE (user_id_1 = $1 AND user_id_2 = $2)
            OR (user_id_1 = $2 AND user_id_2 = $1)`,
        [userId, friendId]
      );
      res.redirect("/friends/page");
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

// Get list of friends
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.session.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.avatar_url
       FROM friendships f
       JOIN users u ON (u.id = f.user_id_1 OR u.id = f.user_id_2)
       WHERE f.status = 'accepted'
         AND (f.user_id_1 = $1 OR f.user_id_2 = $1)
         AND u.id != $1`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Search users by username
router.get('/search', async (req: AuthenticatedRequest, res: Response) => {
  const query = req.query.username;
  const currentUserId = req.session.user?.id;

  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Invalid search' });
    return;
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, username, avatar_url FROM users
       WHERE username ILIKE $1 AND id != $2
       LIMIT 10`,
      [`%${query}%`, currentUserId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});


router.get('/page', async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/auth/login');
  
    try {
      const { rows: accepted } = await pool.query(
        `SELECT u.id, u.username, u.avatar_url FROM friendships f
         JOIN users u ON (u.id = f.user_id_1 OR u.id = f.user_id_2)
         WHERE f.status = 'accepted'
           AND (f.user_id_1 = $1 OR f.user_id_2 = $1)
           AND u.id != $1`, [userId]);
  
      const { rows: pending } = await pool.query(
        `SELECT u.id, u.username, u.avatar_url FROM friendships f
         JOIN users u ON u.id = f.user_id_1
         WHERE f.status = 'pending' AND f.user_id_2 = $1`, [userId]);
  
      res.render('friends', { friends: accepted, pending });
    } catch (err) {
      console.error('Error rendering friends page:', err);
      res.status(500).send('Failed to load friends page');
    }
  });

  // Friends API
  router.get('/api', async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.session.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not logged in' });
      return;
    }
  
    try {
      const { rows } = await pool.query(`
        SELECT 
          u.id,
          u.username,
          u.avatar_url,
          CASE 
            WHEN f.status = 'accepted' THEN 'accepted'
            WHEN f.status = 'pending' AND f.user_id_1 = $1 THEN 'pending'
            WHEN f.status = 'pending' AND f.user_id_2 = $1 THEN 'incoming'
          END AS status
        FROM friendships f
        JOIN users u 
          ON (u.id = f.user_id_2 AND f.user_id_1 = $1)
          OR (u.id = f.user_id_1 AND f.user_id_2 = $1)
        WHERE u.id != $1
        ORDER BY u.username
      `, [userId]);
  
      res.json({ friends: rows });
    } catch (err) {
      console.error('Error fetching friends:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  
  
  
  
  
  
  
  

export default router;
