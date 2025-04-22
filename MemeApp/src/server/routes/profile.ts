import express from 'express';
import type { Response } from 'express';
import { usersService } from '../../services/users.service';
import type { AuthenticatedRequest } from '../../types/authenticated-request';
import { pool } from '../../config/database';
import multer from 'multer';
import path from 'path';
import bcrypt from 'bcrypt';

const router = express.Router();

// Multer config for avatar uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../public/uploads/avatars'),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Profile page
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.session.user) return res.redirect('/auth/login');
    const userId = req.session.user.id;

    const { rows } = await pool.query(
      `SELECT 
        games_played,
        games_won,
        total_points,
        highest_score,
        current_win_streak,
        ROUND(CASE WHEN games_played > 0 THEN total_points::float / games_played ELSE 0 END) AS avg_score
      FROM users
      WHERE id = $1`,
      [userId]
    );

    const userStats = rows[0] || {
      games_played: 0,
      games_won: 0,
      total_points: 0,
      highest_score: 0,
      current_win_streak: 0,
      avg_score: 0,
    };

    const stats = {
      gamesPlayed: userStats.games_played,
      wins: userStats.games_won,
      avgScore: userStats.avg_score,
      highestScore: userStats.highest_score,
      currentWinStreak: userStats.current_win_streak,
      totalPoints: userStats.total_points,
    };

    const starredMemes = await usersService.getStarredMemes(userId);

    // 👇 Add this to fetch the friend count
    const { rows: [friendStats] } = await pool.query(
      `SELECT COUNT(*) AS count FROM friendships 
       WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'`, 
      [userId]
    );
    const friendCount = parseInt(friendStats.count, 10);

    // ✅ Include friendCount in render
    res.render('profile', {
      user: req.session.user,
      stats,
      starredMemes,
      friendCount,
      session: req.session
    });

  } catch (err) {
    console.error('Error loading profile page:', err);
    res.status(500).send('Internal Server Error');
  }
});


// Edit profile form
// Edit Profile Routes
router.get('/edit', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.render('edit-profile', { user: req.session.user });
});

router.post('/edit', upload.single('avatar'), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.session.user?.id;
  const { email, password, winningMessage } = req.body;

  if (!userId) return res.redirect('/auth/login');

  try {
    if (email) {
      await pool.query('UPDATE users SET email = $1 WHERE id = $2', [email, userId]);
      req.session.user!.email = email;
    }

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, userId]);
    }

    if (winningMessage !== undefined) {
      await pool.query('UPDATE users SET winning_message = $1 WHERE id = $2', [winningMessage, userId]);
      req.session.user!.winning_message = winningMessage;
    }

    if (req.file) {
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, userId]);
      req.session.user!.avatarUrl = avatarUrl;
    }

    res.redirect(`/profile/${userId}`);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).send('Update failed');
  }
});

// Add friend (instant accept for now)
router.post('/add-friend', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.session.user?.id;
  const { targetId } = req.body;

  if (!userId || !targetId) {
    res.status(400).json({ success: false, message: 'Missing user IDs' });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO friendships (user_id_1, user_id_2, status)
       VALUES ($1, $2, 'accepted')
       ON CONFLICT DO NOTHING`,
      [userId, targetId]
    );
    res.redirect(req.get('referer') || `/profile/${targetId}`);

  } catch (err) {
    console.error('Error adding friend:', err);
    res.status(500).json({ success: false });
  }
});


// Remove friend
router.post('/remove-friend', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.session.user?.id;
  const { targetId } = req.body;

  if (!userId || !targetId) {
    res.status(400).json({ success: false, message: 'Missing user IDs' });
    return;
  }

  try {
    await pool.query(
      `DELETE FROM friendships 
       WHERE (user_id_1 = $1 AND user_id_2 = $2) 
          OR (user_id_1 = $2 AND user_id_2 = $1)`,
      [userId, targetId]
    );
    res.redirect(req.get('referer') || `/profile/${targetId}`);

  } catch (err) {
    console.error('Error removing friend:', err);
    res.status(500).json({ success: false });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const profileId = parseInt(req.params.id, 10);
  const currentUserId = req.session.user?.id;

  if (isNaN(profileId)) {
    res.status(400).send('Invalid user ID');
    return;
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, username, avatar_url FROM users WHERE id = $1`,
      [profileId]
    );

    const profileUser = rows[0];
    if (!profileUser) {
      res.status(404).send('User not found');
      return;
    }

    const { rows: statRows } = await pool.query(
      `
      SELECT 
        games_played,
        games_won,
        total_points,
        highest_score,
        current_win_streak,
        ROUND(CASE WHEN games_played > 0 THEN total_points::float / games_played ELSE 0 END) AS avg_score
      FROM users
      WHERE id = $1
      `,
      [profileId]
    );

    const stats = {
      gamesPlayed: statRows[0]?.games_played || 0,
      wins: statRows[0]?.games_won || 0,
      avgScore: statRows[0]?.avg_score || 0,
      highestScore: statRows[0]?.highest_score || 0,
      currentWinStreak: statRows[0]?.current_win_streak || 0,
      totalPoints: statRows[0]?.total_points || 0,
    };

    const starredMemes = await usersService.getStarredMemes(profileId);

    const { rows: [friendStats] } = await pool.query(
      `SELECT COUNT(*) AS count FROM friendships 
       WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'`, [profileId]);
    const friendCount = parseInt(friendStats.count, 10);

    let isFriend = false;

    if (currentUserId && currentUserId !== profileId) {
      const { rows: friendshipRows } = await pool.query(
        `
        SELECT 1 FROM friendships
        WHERE ((user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1))
          AND status = 'accepted'
        LIMIT 1
        `,
        [currentUserId, profileId]
      );
      isFriend = friendshipRows.length > 0;
    }

    res.render('profile', {
      user: profileUser,
      stats,
      starredMemes,
      friendCount,
      isFriend,
      session: req.session
    });
  } catch (err) {
    console.error('Error loading user profile:', err);
    res.status(500).send('Server error');
  }
});

// Star a meme
router.post('/star', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.session.user?.id;
  const { imageUrl } = req.body;

  if (!userId || !imageUrl) {
    res.status(400).json({ success: false });
    return;
  }

  try {
    await usersService.starMeme(userId, imageUrl);
    res.json({ success: true });
  } catch (err) {
    console.error('Error starring meme:', err);
    res.status(500).json({ success: false });
  }
});

// Like a meme
router.post('/like', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.session.user?.id;
  const { memeId } = req.body;

  if (!userId || !memeId) {
    res.status(400).json({ success: false });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO meme_likes (user_id, meme_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, meme_id) DO NOTHING`,
      [userId, memeId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error liking meme:', err);
    res.status(500).json({ success: false });
  }
});

// Comment on a meme
router.post('/comment', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.session.user?.id;
  const { memeId, content } = req.body;

  if (!userId || !memeId || !content) {
    res.status(400).json({ success: false, error: 'Missing fields' });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO meme_comments (user_id, meme_id, content)
       VALUES ($1, $2, $3)`,
      [userId, memeId, content]
    );
    res.redirect('/profile');
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

router.post('/unstar', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.session.user?.id;
  const { imageUrl } = req.body;

  if (!userId || !imageUrl) {
    console.warn('❌ Missing userId or imageUrl for unstar');
    res.status(400).send('Missing info');
    return;
  }

  await pool.query(
    `DELETE FROM starred_memes WHERE user_id = $1 AND image_url = $2`,
    [userId, imageUrl]
  );

  res.redirect(`/profile/${userId}`);
});





export default router;
