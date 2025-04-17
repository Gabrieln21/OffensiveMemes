/**
 * Leaderboard Routes Module
 * Handles the display of player rankings, statistics, and achievements.
 * These routes are prefixed with /leaderboard when mounted in the main application.
 */

import express from "express";
import { pool } from '../../config/database';

/**
 * Express router instance to handle leaderboard routes
 */
const router = express.Router();

/**
 * Player Statistics Interface
 * Defines the structure of player statistics data
 */
interface PlayerStats {
    username: string;
    total_points: number;
    games_won: number;
    games_played: number;
    win_rate: number;
    current_win_streak: number;
    highest_score: number;
}

/**
 * Leaderboard Page Route
 * GET /leaderboard
 *
 * Renders the leaderboard page showing player rankings and statistics.
 * Queries real player data from the database.
 *
 * @route GET /leaderboard
 * @renders leaderboard - The leaderboard page template
 * @param {Object} data - Template data
 * @param {PlayerStats[]} data.players - Full list of players and their stats
 * @param {PlayerStats[]} data.topPlayers - Top 3 players for special display
 */
router.get("/", async (req, res) => {
    try {
        const { rows: players } = await pool.query(`
            SELECT 
              username,
              total_points,
              games_won,
              games_played,
              current_win_streak,
              highest_score,
              ROUND(CASE WHEN games_played > 0 THEN (games_won::float / games_played) * 100 ELSE 0 END) AS win_rate
            FROM users
            ORDER BY total_points DESC
            LIMIT 50
          `);          
          console.log("🏆 Total players fetched:", players.length);
          players.forEach((p, i) => {
            console.log(`#${i + 1}:`, p.username, "-", p.total_points, "pts");
          });
          res.render('leaderboard', {
            players,
            topPlayers: players.slice(0, 3) // 👈🏽 This part ensures top 3 are passed
          });
    } catch (err) {
        console.error("Error loading leaderboard:", err);
        res.status(500).send("Internal Server Error");
    }
});

export default router;
