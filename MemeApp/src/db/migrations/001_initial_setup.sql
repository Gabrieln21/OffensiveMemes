-- ✅ Friendships table (simplified and in use by current routes)
DROP TABLE IF EXISTS friendships CASCADE;
CREATE TABLE friendships (
  user_id_1 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id_2 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id_1, user_id_2)
);

-- ✅ Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Who receives this
    from_user_id INTEGER REFERENCES users(id), -- Optional: who triggered it
    type VARCHAR(50) NOT NULL, -- 'new_meme', 'friend_request', etc.
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 🔁 Enhanced starred_memes table for social features
DROP TABLE IF EXISTS starred_memes;
CREATE TABLE starred_memes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    game_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, image_url)
);

-- ✅ Meme Likes
CREATE TABLE IF NOT EXISTS meme_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    meme_id INTEGER REFERENCES starred_memes(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, meme_id)
);

-- ✅ Meme Comments
CREATE TABLE IF NOT EXISTS meme_comments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    meme_id INTEGER REFERENCES starred_memes(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
