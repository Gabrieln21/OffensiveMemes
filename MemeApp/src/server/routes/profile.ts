import express from 'express';
import type { Response } from 'express';
import { usersService } from '../../services/users.service';
import type { AuthenticatedRequest } from '../../types/authenticated-request';
import { pool } from '../../config/database';
import multer from 'multer';
import path from 'path';
import bcrypt from "bcrypt";

const router = express.Router();

// Configure Multer
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../public/uploads/avatars'),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }

    const userId = req.session.user.id;

    // 👇 Pull real stats from database
    const { rows } = await pool.query(
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
      [userId]
    );

    router.get('/edit', async (req: AuthenticatedRequest, res: Response) => {
      if (!req.session.user) return res.redirect('/auth/login');
    
      const user = req.session.user;
      res.render('edit-profile', { user });
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
    
        res.redirect('/profile');
      } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).send('Update failed');
      }
    });
    

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

    res.render('profile', {
      user: req.session.user,
      stats,
      starredMemes,
      session: req.session
    });
  } catch (err) {
    console.error('Error loading profile page:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/star', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

export default router;
