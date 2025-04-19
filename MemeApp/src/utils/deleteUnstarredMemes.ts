import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

export async function deleteUnstarredMemes(gameId: string) {
  const generatedDir = path.resolve('src/public/generated');

  try {
    // Get starred image URLs (e.g., "/generated/meme-123.png")
    const { rows } = await pool.query(
      `SELECT image_url FROM starred_memes WHERE game_id = $1`,
      [gameId]
    );
    const starredSet = new Set(rows.map(row => row.image_url));

    const files = fs.readdirSync(generatedDir);

    for (const file of files) {
        // Only delete memes generated during this game
        if (!file.startsWith(`meme-${gameId}-`)) continue;
      
        const relPath = `/generated/${file}`;
        if (!starredSet.has(relPath)) {
          const fullPath = path.join(generatedDir, file);
          fs.unlinkSync(fullPath);
          console.log(`🧹 Deleted unstarred meme: ${relPath}`);
        }
      }
      

    console.log(`🧼 Deleted unstarred memes for game ${gameId}`);
  } catch (err) {
    console.error(`❌ Error during meme cleanup:`, err);
  }
}
