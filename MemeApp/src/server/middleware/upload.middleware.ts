import multer from 'multer';
import path from 'path';
import fs from 'fs';

const avatarPath = path.join(__dirname, '../public/uploads/avatars');

// ✅ Ensure the directory exists
if (!fs.existsSync(avatarPath)) {
  fs.mkdirSync(avatarPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarPath);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

export const uploadAvatar = multer({ storage });
