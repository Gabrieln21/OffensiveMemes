import fs from 'fs';
import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import { requireGuest } from "../middleware/authentication";
import { usersService } from "../../services/users.service";
import session from 'express-session';
import type { AuthenticatedRequest } from '../../types/authenticated-request';


const router = express.Router();

// 🖼️ Multer config for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'src/public/uploads/avatars');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

router.get("/signup", requireGuest, (req, res) => {
  console.log("👤 Guest route hit, session.userId:", req.session?.userId);
  res.render("auth/signup", { title: "Sign Up" });
});

// 👤 Register route
router.post('/register', requireGuest, upload.single('avatar'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  console.log('req.file:', req.file);

  try {
    const { username, email, password } = req.body;
    const avatarUrl = req.file ? `/uploads/avatars/${req.file.filename}` : '/uploads/avatars/default-avatar.png';

    const existingUsername = await usersService.findByUsername?.(username);
    if (existingUsername) {
      res.status(400).send('Username already exists'); // You can customize this for form feedback later
      return;
    }

    const existingEmail = await usersService.findByEmail(email);
    if (existingEmail) {
      res.status(400).send('Email already exists');
      return;
    }

    const user = await usersService.register(username, email, password, avatarUrl);

    req.session!.userId = user.id;
    req.session!.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatar_url || undefined,
      winning_message: user.winning_message || ''
    };

    res.redirect('/'); // ✅ Send them to the lobby or game page after registration
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).send('Something went wrong. Please try again later.');
  }
});

// 🪪 Show login form
router.get('/login', requireGuest, (_req, res) => {
  res.render('auth/login', { messages: {} });
});

// 🔐 Login route
router.post('/login', requireGuest, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password } = req.body;
    const user = await usersService.login(username, password);

    if (!user) {
      return res.status(401).render("auth/login", {
        messages: { error: "Invalid username or password" }
      });
    }

    req.session!.userId = user.id;
    req.session!.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatar_url || undefined,
      winning_message: user.winning_message || ''
    };

    res.redirect("/"); // ✅ Redirect after successful login
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send("Internal server error");
  }
});



// 🚪 Logout route (redirect version)
router.post('/logout', (req: AuthenticatedRequest, res: Response): void => {
  req.session!.destroy((err: any) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.redirect('/'); // 🔁 Send user back to homepage after logout
  });
});



// 🙋 Get current user
router.get('/me', async (req: AuthenticatedRequest, res: Response): Promise<void> => {

  try {
    if (!req.session!.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await usersService.findById(req.session!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ✅ ADD THIS AT THE BOTTOM OF auth.ts
export default router;

