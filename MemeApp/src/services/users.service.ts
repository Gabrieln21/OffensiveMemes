/**
 * User Service Module
 * Provides core functionality for user management including registration,
 * authentication, and user data retrieval.
 */

import bcrypt from "bcrypt";
import { pool } from '../config/database';

/**
 * User Interface
 * Defines the structure of a user object in the system
 *
 * @interface User
 * @property {number} id - Unique identifier for the user
 * @property {string} username - User's chosen username
 * @property {string} email - User's email address
 * @property {string} [password_hash] - Hashed password (optional as it's not always returned)
 * @property {Date} created_at - Timestamp of account creation
 * @property {Date} [last_login] - Timestamp of last login (optional)
 */
interface User {
    id: number;
    username: string;
    email: string;
    avatar_url?: string;
    password_hash?: string;
    created_at: Date;
    last_login?: Date;
    winning_message?: string;
}


/**
 * Users Service Class
 * Handles all user-related operations including authentication and data management
 */
class UsersService {
    /** Number of salt rounds for password hashing */
    private static readonly SALT_ROUNDS = 10;

    /**
     * Register a new user
     * Creates a new user account with the provided credentials
     *
     * @param {string} username - Desired username for the new account
     * @param {string} email - User's email address
     * @param {string} password - User's chosen password (will be hashed)
     * @returns {Promise<Omit<User, 'password_hash'>>} User object without password hash
     * @throws {Error} If registration fails or database constraints are violated
     */

    hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, UsersService.SALT_ROUNDS);
      }

    async register(
        username: string,
        email: string,
        password: string,
        avatarUrl: string
    ): Promise<Omit<User, 'password_hash'>> {
        const password_hash = await bcrypt.hash(password, UsersService.SALT_ROUNDS);
    
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, avatar_url, created_at) 
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
             RETURNING id, username, email, avatar_url, created_at, last_login`,
            [username, email, password_hash, avatarUrl]
        );
    
        return result.rows[0];
    }    
    

    /**
     * Authenticate user login
     * Verifies user credentials and updates last login timestamp
     *
     * @param {string} username - Username to authenticate
     * @param {string} password - Password to verify
     * @returns {Promise<Omit<User, 'password_hash'> | null>} User object if authenticated, null if invalid
     * @throws {Error} If database query fails
     */
    async login(username: string, password: string): Promise<Omit<User, 'password_hash'> | null> {
        const result = await pool.query(
          `SELECT id, username, email, password_hash, avatar_url, winning_message, created_at, last_login 
           FROM users 
           WHERE username = $1`,
          [username]
        );
      
        if (result.rows.length === 0) {
          return null;
        }
      
        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
      
        if (!passwordMatch) {
          return null;
        }
      
        // Update last login time
        await pool.query(
          `UPDATE users 
           SET last_login = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [user.id]
        );
      
        const { password_hash, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
      

    /**
     * Find user by email
     * Retrieves user information based on email address
     *
     * @param {string} email - Email address to search for
     * @returns {Promise<Omit<User, 'password_hash'> | null>} User object if found, null if not found
     * @throws {Error} If database query fails
     */
    async findByEmail(email: string): Promise<Omit<User, 'password_hash'> | null> {
        const result = await pool.query(
            `SELECT id, username, email, created_at, last_login 
             FROM users 
             WHERE email = $1`,
            [email]
        );
        return result.rows[0] || null;
    }

    /**
     * Find user by ID
     * Retrieves user information based on user ID
     *
     * @param {number} id - User ID to search for
     * @returns {Promise<Omit<User, 'password_hash'> | null>} User object if found, null if not found
     * @throws {Error} If database query fails
     */

    

    async findById(id: number): Promise<Omit<User, 'password_hash'> | null> {
        const result = await pool.query(
            `SELECT id, username, email, avatar_url, created_at, last_login, winning_message
             FROM users 
             WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }
    
    async findByUsername(username: string): Promise<Omit<User, 'password_hash'> | null> {
        const result = await pool.query(
          `SELECT id, username, email, avatar_url, created_at, last_login, winning_message
           FROM users
           WHERE username = $1`,
          [username]
        );
        return result.rows[0] || null;
    }
    
    async findByUsernameWithPassword(username: string): Promise<User | null> {
        const result = await pool.query(
          `SELECT * FROM users WHERE username = $1`,
          [username]
        );
        return result.rows[0] || null;
    }
    
      // users.service.ts
      // users.service.ts
      async getStarredMemes(profileOwnerId: number) {
        const { rows: memes } = await pool.query(`
          SELECT sm.id, sm.image_url, sm.game_id, sm.created_at,
            COALESCE(ml.likes_count, 0) AS likes,
            COALESCE(mc.comments, '[]') AS comments
          FROM starred_memes sm
          LEFT JOIN (
            SELECT meme_id, COUNT(*) as likes_count
            FROM meme_likes
            GROUP BY meme_id
          ) ml ON ml.meme_id = sm.id
          LEFT JOIN (
            SELECT meme_id,
              json_agg(
                json_build_object(
                  'user_id', mc.user_id,
                  'content', mc.content,
                  'created_at', mc.created_at
                ) ORDER BY mc.created_at DESC
              ) FILTER (WHERE mc.content IS NOT NULL) AS comments
            FROM meme_comments mc
            GROUP BY meme_id
          ) mc ON mc.meme_id = sm.id
          WHERE sm.user_id = $1
          ORDER BY sm.created_at DESC
        `, [profileOwnerId]);
      
        for (const meme of memes) {
          if (!Array.isArray(meme.comments)) {
            try {
              meme.comments = JSON.parse(meme.comments || '[]');
            } catch {
              meme.comments = [];
            }
          }
        }
        
        
        console.log('starredMemes:', memes);
        return memes;
      }
      
            
      
      async starMeme(userId: number, imageUrl: string) {
        await pool.query(
          `INSERT INTO starred_memes (user_id, image_url)
           VALUES ($1, $2)
           ON CONFLICT (user_id, image_url) DO NOTHING`,
          [userId, imageUrl]
        );
      }
      
    
      
      
}

export const usersService = new UsersService();
