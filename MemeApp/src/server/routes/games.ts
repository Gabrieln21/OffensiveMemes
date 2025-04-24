import express, { Request, Response, NextFunction } from "express";
import { gamesService } from "../../services/games.service";
import 'express-session'; // 💥 required for session typing to be applied
import type { AuthenticatedRequest } from '../../types/authenticated-request';
import { Server } from "socket.io";

export default function createGamesRouter(io: Server) {
  const router = express.Router();


router.get("/", (_req, res) => {
  res.render("gameLobby", { title: "Game Lobby" });
});

router.get("/waiting/:gameId", (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("Accessing waiting room with gameId:", req.params.gameId);

  let game = gamesService.getGameById(req.params.gameId) || gamesService.getGame(req.params.gameId);

  if (!game) {
    console.log("Game not found, redirecting to lobby");
    return res.redirect("/games");
  }

  const userId = req.session.userId; // ✅ Properly typed from AuthenticatedRequest
  const isCreator = game.players[0]?.userId === userId;

  console.log("Game found:", {
    id: game.id,
    passcode: game.passcode,
    isCreator,
  });

  res.render("gameWaitingRoom", {
    title: "Game Waiting Room",
    gameId: game.id,
    gameCode: game.passcode,
    isCreator,
  });
});

/**
 * ✅ Start the game by moving from 'waiting' to 'playing'.
 */
router.post(
    "/waiting/:gameId/start",
    (req: Request<{ gameId: string }>, res: Response): void => {
      const typedReq = req as AuthenticatedRequest; // ✅ Explicitly cast `req` for session
  
      let { gameId } = typedReq.params;
      console.log("Starting game with gameId:", gameId);
  
      let game = gamesService.getGameById(gameId) || gamesService.getGame(gameId);
  
      // ✅ If no game exists, CREATE one first
      if (!game) {
        console.log("Game not found, creating a new one...");
        const userId = typedReq.session?.userId;
  
        if (!userId) {
          res.status(403).send("User is not authenticated");
          return;
        }
  
        // Creating a new game with the user as the host
        game = gamesService.createGame(gameId, {
          id: userId.toString(),
          username: "Host", // You can replace this with actual username from session
          socket: {} as any, // Placeholder, should be replaced with a valid socket
          score: 0,
        });
  
        console.log("New game created:", game);
      }
  
      const userId = typedReq.session?.userId;
      if (!userId || game.players[0]?.userId !== userId) {
        res.status(403).send("Only the game creator can start the game");
        return;
      }
  
      try {
        // ✅ Start the game
        gamesService.startGame(game.passcode, io);
        console.log(`Game ${gameId} started successfully!`);
        res.redirect(`/games/play/${game.id}`);
      } catch (err) {
        console.error("Failed to start game:", err);
        res.status(400).send(`Failed to start game: ${err}`);
      }
    }
  );
  

/**
 * ✅ Game Play Route - Handles transitions from waiting to active game.
 */
router.get("/play/:gameId", (req: AuthenticatedRequest, res: Response) => {
  console.log("Accessing game with gameId:", req.params.gameId);

  const game = gamesService.getGameById(req.params.gameId);
  if (!game) {
    console.log("Game not found, redirecting to lobby");
    return res.redirect("/games");
  }

  console.log("Game state:", {
    id: game.id,
    status: game.status,
  });

  const userId = req.session.userId;
  const player = game.players.find((p) => p.userId === userId);

  if (!player) {
    console.log("Player not in game, redirecting to lobby. User ID:", userId);
    return res.redirect("/games");
  }

  if (game.status !== "playing") {
    console.log("Game not started, redirecting to waiting room");
    return res.redirect(`/games/waiting/${game.id}`);
  }

  res.render("game", {
    title: "UNO Game",
    gameId: game.id,
    gameCode: game.passcode,
  });
});

return router;
}

