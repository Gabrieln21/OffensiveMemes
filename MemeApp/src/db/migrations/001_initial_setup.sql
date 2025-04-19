-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255), -- ✅ Optional user avatar
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create session table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL,
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- Create index on session expire
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- ✅ Create starred_memes table
CREATE TABLE IF NOT EXISTS starred_memes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    image_url TEXT NOT NULL,
    game_id TEXT, -- ✅ Used for cleaning up unstarred memes per game
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, image_url)
);
