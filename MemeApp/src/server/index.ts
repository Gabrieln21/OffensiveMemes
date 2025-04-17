/// <reference path="../types/express-session.d.ts" />
import express, { Request, Response, NextFunction } from "express";
import { Server, Socket } from "socket.io";
import { DefaultEventsMap } from "@socket.io/component-emitter";
import { createServer, IncomingMessage } from "http";
import createError from "http-errors";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import flash from "express-flash";
import { auth, home, leaderboard, rules, messagetest } from "./routes";
import createGamesRouter from "./routes/games";
import { sessionMiddleware } from "./middleware/authentication";
import configureLiveReload from "../config/livereload";
import { pool, pool as sessionPool } from "../config/database";
import { gamesService, Game, Player } from "../services/games.service";
import { usersService } from '../services/users.service';
import session, { Session } from 'express-session';
import profileRoutes from './routes/profile';

interface SessionIncomingMessage extends IncomingMessage {
  session: Session & {
    user?: {
      id: number;
      username: string;
      email: string; 
      avatarUrl?: string;
      winning_message: string;
    };
  };
}

const connectPgSimple = require('connect-pg-simple');
const app = express();

app.set("views", path.join(__dirname, "../views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const avatarPath = path.join(__dirname, '../public/uploads/avatars');
console.log('✅ Serving avatars from:', avatarPath);

app.use('/uploads/avatars', express.static(avatarPath));
app.use(express.static(path.join(__dirname, '..', 'public')));

const PostgresStore = connectPgSimple(session);

app.use(
  session({
    store: new PostgresStore({
      pool: sessionPool,
      tableName: "session",
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production"
    }
  })
);

app.use(flash());
app.use(sessionMiddleware);

const PORT = process.env.PORT || 3000;



const findAvailablePort = async (startPort: number): Promise<number> => {
  const maxPort = startPort + 10;
  for (let port = startPort; port <= maxPort; port++) {
    try {
      await new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(port)
          .once('listening', () => {
            server.close();
            resolve(port);
          })
          .once('error', reject);
      });
      return port;
    } catch (err) {
      continue;
    }
  }
  throw new Error('No available ports found');
};

const startServer = async (): Promise<void> => {
  try {
    await configureLiveReload(app);

    const httpServer = createServer(app);
    const io = new Server(httpServer);
    
    // ✅ Mount routes now that io is defined
    app.use("/", home);
    app.use("/auth", auth);
    app.use("/games", createGamesRouter(io));
    app.use("/leaderboard", leaderboard);
    app.use("/rules", rules);
    app.use("/messagetest", messagetest);
    app.use('/profile', profileRoutes); // ✅ This is correct and safe

    // 404 and error handlers
    app.use((_req: Request, _res: Response, next: NextFunction) => {
      next(createError(404));
    });

    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      if (!res.headersSent) {
        res.locals.message = err.message;
        res.locals.error = req.app.get("env") === "development" ? err : {};
        res.status(err.status || 500);
        res.render("error");
      }
    });

    // Setup Socket.IO auth
    const wrap = (middleware: express.RequestHandler) => {
      return (socket: Socket, next: (err?: any) => void) => {
        middleware(socket.request as express.Request, {} as Response, next);
      };
    };

    io.use(wrap(session({
      store: new PostgresStore({
        pool: sessionPool,
        tableName: "session",
        createTableIfMissing: true
      }),
      secret: process.env.SESSION_SECRET || "your_secret_key",
      resave: false,
      saveUninitialized: false
    })));

    io.use((socket, next) => {
      const session = (socket.request as SessionIncomingMessage).session;
      if (session?.user) {
        socket.data.userId = session.user.id;
        socket.data.username = session.user.username;
        return next();
      }
      return next(new Error('Authentication required'));
    });

    const starredMemes: Record<string, {
        gameId: string;
        imageUrl: string;
        captions: any[];
        templateUrl: string;
        starredAt: string;
      }[]> = {};

    io.on('connection', (socket: Socket) => {
            // Handle joining game room
            socket.on('join_game_room', (data: { gameId: string }, callback?: (response: any) => void) => {
                console.log('Socket joining game room:', data.gameId);
                socket.join(`game:${data.gameId}`);
            
                const game = gamesService.getGameById(data.gameId);
            
                if (game) {
                    const player = game.players.find(p => p.userId === socket.data.userId);
                    if (player) {
                        player.socket = socket;
                        player.connected = true;
            
                        const sessionUser = (socket.request as SessionIncomingMessage).session?.user;
            
                        if (!player.avatarUrl || player.avatarUrl === '/uploads/avatars/default-avatar.png') {
                            if (sessionUser?.avatarUrl) {
                                player.avatarUrl = sessionUser.avatarUrl;
                            }
                        }
            
                        // ✅ Ensure ALL players have their avatarUrl assigned from session
                        game.players.forEach(p => {
                            if (!player.avatarUrl || player.avatarUrl === '/uploads/avatars/default-avatar.png') {
                                player.avatarUrl = sessionUser?.avatarUrl || '/uploads/avatars/default-avatar.png';
                            }                 
                        });

                        if (!player.winning_message && sessionUser?.winning_message) {
                            player.winning_message = sessionUser.winning_message;
                        }
                        
                        // Also apply it to all players just like avatars (in case needed)
                        game.players.forEach(p => {
                            if (!p.winning_message && sessionUser?.winning_message) {
                                p.winning_message = sessionUser.winning_message;
                        
                                const existingPlayer = game.players.find(existing => existing.id === p.id);
                                if (existingPlayer) {
                                    existingPlayer.winning_message = sessionUser.winning_message;
                                }
                            }
                        });
                        
            
                        // ✅ Emit playerId for frontend tracking
                        socket.emit('player_info', {
                            playerId: player.id,
                            winning_message: player.winning_message || ''
                          });
            
                        // ✅ Emit full updated state to the NEW player
                        socket.emit('game_state', {
                            currentRound: game.currentRound,
                            totalRounds: game.totalRounds,
                            round: game.round,
                            memeTemplate: game.round?.memeTemplates[player.id],
                            submissions: game.round?.submissions || [],
                            players: game.players.map((p: Player) => ({
                                id: p.id,
                                username: p.username,
                                score: p.score,
                                connected: p.connected,
                                hasSubmitted: p.hasSubmitted,
                                hasVoted: p.hasVoted,
                                votedOn: p.votedOn || [],
                                avatarUrl: p.avatarUrl || '/uploads/avatars/default-avatar.png',
                                winning_message: p.winning_message
                            }))
                        });
            
                        // ✅ Notify existing players about the new join
                        io.to(`game:${data.gameId}`).emit('player_joined', {
                            playerId: player.id,
                            username: player.username,
                            avatarUrl: player.avatarUrl,
                        });
                    }
                }
            
                if (callback) callback({ success: true });
            });
            
            
            // Debug socket session
            console.log('A user connected');

            // Send initial games list to newly connected client
            const initialGames = gamesService.getAllGames().map((g: Game) => ({
                id: g.id,
                passcode: g.passcode,
                status: g.status,
                currentRound: g.currentRound,
                totalRounds: g.totalRounds,
                players: g.players.map((p: Player) => ({
                    id: p.id,
                    username: p.username,
                    connected: p.connected,
                    score: p.score,
                    hasSubmitted: p.hasSubmitted,
                    hasVoted: p.hasVoted
                }))
            }));
            console.log('Sending initial games list to new connection:', initialGames);
            socket.emit('games_update', initialGames);
            socket.on('create_game', async (data: { passcode: string }, callback: (response: any) => void) => {
                try {
                    console.log('Creating game with passcode:', data.passcode);
                    const session = (socket.request as SessionIncomingMessage).session;
                    console.log('Socket session:', session);
            
                    const sessionUser = (socket.request as SessionIncomingMessage).session?.user;

                    const avatarUrl = sessionUser?.avatarUrl || '/uploads/avatars/default-avatar.png';

                    const player: Player = {
                        id: socket.data.userId.toString(),
                        userId: socket.data.userId,
                        username: socket.data.username || 'Anonymous',
                        avatarUrl, // ✅ Always store it once!
                        winning_message: socket.data.winning_message,
                        socket: socket as Socket,
                        connected: true,
                        score: 0,
                        hasSubmitted: false,
                        hasVoted: false
                    };

            
                    console.log('Player data:', player);
            
                    const game = gamesService.createGame(data.passcode, player);
                    console.log('Game created:', {
                        id: game.id,
                        passcode: game.passcode,
                        players: game.players.map(p => ({ id: p.id, username: p.username, connected: p.connected })),
                        status: game.status,
                        currentRound: game.currentRound,
                        totalRounds: game.totalRounds
                    });
            
                    socket.join(`game:${game.id}`);
            
                    io.to(`game:${game.id}`).emit('game_state', {
                        currentRound: game.currentRound,
                        totalRounds: game.totalRounds,
                        round: game.round,
                        memeTemplate: game.round?.memeTemplates[player.id],
                        submissions: game.round?.submissions || [],
                        players: game.players.map((p: Player) => ({
                            id: p.id,
                            username: p.username,
                            score: p.score,
                            connected: p.connected,
                            hasSubmitted: p.hasSubmitted,
                            hasVoted: p.hasVoted,
                            votedOn: p.votedOn || [],
                            avatarUrl: p.avatarUrl || '/uploads/avatars/default-avatar.png',
                            winning_message: p.winning_message
                        })),
                        ...(game.round?.status === 'results' && {
                            results: game.round?.submissions.map(s => ({
                                username: s.username,
                                memeUrl: game.round?.memeTemplates.url,
                                votes: s.votes.length
                            }))
                        })
                    });
            
                    io.emit('games_update', gamesService.getAllGames().map(g => ({
                        id: g.id,
                        passcode: g.passcode,
                        status: g.status,
                        players: g.players.map(p => ({
                            id: p.id,
                            username: p.username,
                            connected: p.connected,
                            score: p.score
                        }))
                    })));
            
                    callback({ success: true, gameId: game.id });
                } catch (error: any) {
                    console.error('Error creating game:', error);
                    callback({ error: error.message });
                }
            });
            // Handle joining game
            socket.on('join_game', async (data: { passcode: string }, callback: (response: any) => void) => {
                try {
                    console.log('Joining game with passcode:', data.passcode);
            
                    const sessionUser = (socket.request as SessionIncomingMessage).session?.user;
                    const avatarUrl = sessionUser?.avatarUrl || '/uploads/avatars/default-avatar.png';

                    const player: Player = {
                        id: socket.data.userId.toString(),
                        userId: socket.data.userId,
                        username: socket.data.username || 'Anonymous',
                        avatarUrl, // ✅ Always store it once!
                        socket: socket as Socket,
                        connected: true,
                        score: 0,
                        hasSubmitted: false,
                        hasVoted: false
                    };

            
                    const game = gamesService.joinGame(data.passcode, player);

            
                    console.log('Player joined game:', {
                        id: game.id,
                        passcode: game.passcode,
                        players: game.players.map(p => ({
                            id: p.id,
                            username: p.username,
                            connected: p.connected,
                            avatarUrl: p.avatarUrl || '/uploads/avatars/default-avatar.png'
                        })),
                        status: game.status
                    });
            
                    socket.join(`game:${game.id}`);
            
                    const joinedPlayer = game.players.find(p => p.userId === socket.data.userId);
                    if (joinedPlayer) {
                        io.to(`game:${game.id}`).emit('game_state', {
                            currentRound: game.currentRound,
                            totalRounds: game.totalRounds,
                            round: game.round,
                            memeTemplate: game.round?.memeTemplates[player.id],
                            submissions: game.round?.submissions || [],
                            players: game.players.map((p: Player) => ({
                                id: p.id,
                                username: p.username,
                                score: p.score,
                                connected: p.connected,
                                hasSubmitted: p.hasSubmitted,
                                hasVoted: p.hasVoted,
                                votedOn: p.votedOn || [],
                                avatarUrl: p.avatarUrl || '/uploads/avatars/default-avatar.png',
                                winning_message: p.winning_message
                            })),
                            ...(game.round?.status === 'results' && {
                                results: game.round?.submissions.map(s => ({
                                    username: s.username,
                                    memeUrl: game.round?.memeTemplates.url,
                                    votes: s.votes.length
                                }))
                            })
                        });
                    }
                    console.log('📸 Emitting player_joined with players:', game.players.map(p => ({
                        id: p.id,
                        username: p.username,
                        avatarUrl: p.avatarUrl
                    })));
                    
                    io.to(`game:${game.id}`).emit('player_joined', {
                        playerId: player.id,
                        username: player.username,
                        players: game.players.map(p => ({
                            id: p.id,
                            username: p.username,
                            connected: p.connected,
                            score: p.score,
                            avatarUrl: p.avatarUrl || '/uploads/avatars/default-avatar.png'
                        }))
                    });
                    
                                          
            
                    io.emit('games_update', gamesService.getAllGames().map(g => ({
                        id: g.id,
                        passcode: g.passcode,
                        status: g.status,
                        players: g.players.map(p => ({
                            id: p.id,
                            username: p.username,
                            connected: p.connected,
                            score: p.score
                        }))
                    })));
            
                    callback({ success: true, gameId: game.id });
                } catch (error: any) {
                    console.error('Error joining game:', error);
                    callback({ error: error.message });
                }
            });
            
            

            socket.on('get_game_players', (data: { gameId: string }, callback: (response: { success?: boolean; error?: string; players?: any[] }) => void) => {
                const game = gamesService.getGameById(data.gameId);
                if (!game) {
                    return callback({ error: 'Game not found' });
                }
            
                const players = game.players.map(p => ({
                    id: p.id,
                    username: p.username,
                    score: p.score,
                    connected: p.connected,
                    avatarUrl: p.avatarUrl || '/uploads/avatars/default-avatar.png' // 👈 this matters!
                  }));
                  
            
                callback({ success: true, players });
            });
            socket.on('star_meme', async (data: {
                gameId: string;
                imageUrl: string;
                captions: any[];
                templateUrl: string;
            }) => {
                const { gameId, imageUrl, captions, templateUrl } = data;
                console.log('🧠 socket.data.userId:', socket.data.userId);
                const userId = socket.data.userId;
                console.log('📥 star_meme received');
                if (!userId) {
                    console.warn("⚠️ Tried to star meme without a user ID.");
                    return;
                }
            
                if (!imageUrl) {
                    console.warn("⚠️ Tried to star meme without an image URL.");
                    return;
                }
            
                console.log(`⭐ Meme starred by ${userId}: ${imageUrl}`);
            
                // ✅ Save in-memory
                if (!starredMemes[userId]) starredMemes[userId] = [];
            
                starredMemes[userId].push({
                    gameId,
                    imageUrl,
                    captions,
                    templateUrl,
                    starredAt: new Date().toISOString()
                });
            
                // ✅ Save to DB
                try {
                    await pool.query(
                        `INSERT INTO starred_memes (user_id, image_url) 
                         VALUES ($1, $2) 
                         ON CONFLICT (user_id, image_url) DO NOTHING`,
                        [userId, imageUrl]
                    );
                    console.log(`🗃️ Saved starred meme to DB for user ${userId}`);
                } catch (err) {
                    console.error('❌ Error saving starred meme to DB:', err);
                }
            });
            
            
            // Handle game chat
            socket.on('game_chat', (data: { gameId: string; message: string }) => {
                try {
                    console.log('Received chat message:', data);

                    if (!data.gameId) {
                        console.error('No gameId provided for chat message');
                        return;
                    }

                    if (!socket.data.username) {
                        console.error('No username found for socket');
                        return;
                    }

                    const game = gamesService.getGameById(data.gameId);
                    if (!game) {
                        console.error('Game not found for chat message:', data.gameId);
                        return;
                    }

                    // Verify the user is in the game
                    const isPlayerInGame = game.players.some(p => p.userId === socket.data.userId);
                    if (!isPlayerInGame) {
                        console.error('User not in game:', socket.data.userId);
                        return;
                    }

                    // Create chat message with user info
                    const chatMessage = {
                        username: socket.data.username,
                        message: data.message,
                        timestamp: new Date()
                    };
                    console.log('Emitting chat message:', chatMessage);

                    // Emit to all players in the game room
                    io.to(`game:${data.gameId}`).emit('game_chat', chatMessage);
                    console.log('Message emitted to room:', `game:${data.gameId}`);

                    // If message contains "uno" (case insensitive), emit a system message
                    if (data.message.toLowerCase().includes('uno')) {
                        io.to(`game:${data.gameId}`).emit('game_event', {
                            message: `${chatMessage.username} called UNO!`
                        });
                    }
                } catch (error) {
                    console.error('Error handling game chat:', error);
                }
            });

            socket.on('request_reroll', (data: { gameId: string }) => {
                const playerId = socket.data.userId?.toString();
                if (!playerId) return;
              
                const result = gamesService.rerollTemplate(data.gameId, playerId);
              
                if (result.success && result.newTemplate) {
                  socket.emit('reroll_result', {
                    success: true,
                    newTemplate: result.newTemplate,
                    remaining: result.remaining, // ✅ Make sure rerollTemplate returns this
                  });
                } else {
                  socket.emit('reroll_result', {
                    success: false,
                    error: result.error,
                  });
                }
            });
              
              
            
              

            socket.on('submit_meme', async (data: { gameId: string, captions: { text: string; top: string; left: string }[] }, callback: (response: any) => void) => {
                console.log("🧠 Received meme submission:", data);
                try {
                    console.log('Submit meme request:', { gameId: data.gameId, userId: socket.data.userId, captions: data.captions });
            
                    const result = await gamesService.submitMeme(data.gameId, socket.data.userId.toString(), data.captions, io);
            
                    if (result.success && result.game) {
                        const game = result.game;
            
                        if (game.status === 'finished' && game.winner) {
                            io.to(`game:${data.gameId}`).emit('game_over', {
                                winner: game.winner,
                                players: game.players.map((p: Player) => ({
                                    id: p.id,
                                    username: p.username,
                                    score: p.score,
                                    connected: p.connected,
                                    hasSubmitted: p.hasSubmitted,
                                    hasVoted: p.hasVoted,
                                    avatarUrl: p.avatarUrl || '/uploads/avatars/default-avatar.png',
                                    winning_message: p.winning_message
                                  }))
                            });
                        }
            
                        io.to(`game:${data.gameId}`).emit('meme_submitted', {
                            playerId: socket.data.userId,
                            username: socket.data.username,
                            round: game.round,
                            currentRound: game.currentRound
                        });
            
                        game.players.forEach((p: Player) => {
                            const playerSocket = p.socket;
                            if (playerSocket) {
                                io.to(`game:${data.gameId}`).emit('game_state', {
                                    currentRound: game.currentRound,
                                    totalRounds: game.totalRounds,
                                    round: game.round,
                                    memeTemplate: game.round?.memeTemplates[p.id],
                                    submissions: game.round?.submissions || [],
                                    players: game.players.map((p: Player) => ({
                                        id: p.id,
                                        username: p.username,
                                        score: p.score,
                                        connected: p.connected,
                                        hasSubmitted: p.hasSubmitted,
                                        hasVoted: p.hasVoted,
                                        votedOn: p.votedOn || [],
                                        avatarUrl: p.avatarUrl || '/uploads/avatars/default-avatar.png',
                                        winning_message: p.winning_message
                                    })),
                                    ...(game.round?.status === 'results' && {
                                        results: game.round?.submissions.map(s => ({
                                            username: s.username,
                                            memeUrl: s.imageUrl, // ✅ Use rendered image here
                                            votes: s.votes.length
                                        }))
                                    })
                                });
                            }
                        });
            
                        callback({ success: true, imageUrl: result.imageUrl });
                    } else {
                        callback({ success: false, error: result.error || 'Failed to submit meme' });
                    }
                } catch (error: any) {
                    console.error('Error submitting meme:', error);
                    callback({ success: false, error: error.message });
                }
            });
            

            socket.on(
                'submit_vote',
                (
                  data: { gameId: string; submissionPlayerId: string; voteType: 'like' | 'meh' | 'pass' },
                  callback: (response: any) => void
                ) => {
                  try {
                    const userId = socket.data.userId?.toString();
                    if (!userId) {
                      return callback({ success: false, error: 'Unauthorized user' });
                    }
              
                    console.log("🎯 Vote received:", data);
              
                    const result = gamesService.handleVoteSubmission(socket, data, io);
              
                    if (!result.success) {
                      return callback({ success: false, error: result.error });
                    }
              
                    callback({ success: true });
                  } catch (error: any) {
                    console.error('❌ Error in submit_vote handler:', error);
                    callback({ success: false, error: error.message });
                  }
                }
              );
              
              
              
            
            
            
            // Handle starting the game
            socket.on('start_game', (data: { gameId: string }, callback: (response: any) => void) => {
                try {
                    const game = gamesService.getGameById(data.gameId);
                    if (!game) {
                        return callback({ success: false, error: 'Game not found' });
                    }

                    // Verify the user is the game creator
                    if (game.players[0].userId !== socket.data.userId) {
                        return callback({ success: false, error: 'Only the game creator can start the game' });
                    }

                    // Ensure minimum number of players (2)
                    if (game.players.length < 2) {
                        return callback({ success: false, error: 'Need at least 2 players to start' });
                    }

                    // Update game status and start first round
                    game.status = 'playing';
                    gamesService.startNewRound(game.id, io);
                    gamesService.updateGame(game);

                    // Notify all players in the game room
                    io.to(`game:${game.id}`).emit('game_started', {
                        gameId: game.id,
                        status: 'playing'
                    });

                    // Send initial game state to all players
                    game.players.forEach(player => {
                        const playerSocket = player.socket;
                        if (playerSocket) {
                            io.to(`game:${data.gameId}`).emit('game_state', {
                                currentRound: game.currentRound,
                                totalRounds: game.totalRounds,
                                round: game.round,
                                memeTemplate: game.round?.memeTemplates[player.id],
                                submissions: game.round?.submissions || [],
                                players: game.players.map((p: Player) => ({
                                    id: p.id,
                                    username: p.username,
                                    score: p.score,
                                    connected: p.connected,
                                    hasSubmitted: p.hasSubmitted,
                                    hasVoted: p.hasVoted,
                                    votedOn: p.votedOn || [],
                                    avatarUrl: p.avatarUrl || '/uploads/avatars/default-avatar.png',
                                    winning_message: p.winning_message
                                })),
                                ...(game.round?.status === 'results' && {
                                  results: game.round?.submissions.map(s => ({
                                    username: s.username,
                                    memeUrl: game.round?.memeTemplates.url, // or generate unique meme images if you support that
                                    votes: s.votes.length
                                  }))
                                })
                              });                            
                        }
                    });

                    callback({ success: true });
                } catch (error: any) {
                    console.error('Error starting game:', error);
                    callback({ success: false, error: error.message });
                }
            });

            // Handle rematch requests
            socket.on('request_rematch', (data: { gameId: string }, callback: (response: any) => void) => {
                try {
                    const game = gamesService.getGameById(data.gameId);
                    if (!game) {
                        return callback({ success: false, error: 'Game not found' });
                    }

                    // Create a new game with the same players
                    const newGame = gamesService.createRematch(game);

                    // Notify all players about the rematch
                    io.to(`game:${game.id}`).emit('rematch_started', {
                        oldGameId: game.id,
                        newGameId: newGame.id,
                        passcode: newGame.passcode
                    });

                    callback({ success: true, gameId: newGame.id });
                } catch (error: any) {
                    console.error('Error handling rematch:', error);
                    callback({ success: false, error: error.message });
                }
            });
        }); // End of socket.io connection handler

        const availablePort = await findAvailablePort(Number(PORT));
        httpServer.listen(availablePort, () => {
            console.log(`🚀 Server running on port ${availablePort}`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔒 Session security: ${process.env.NODE_ENV === 'production' ? 'Secure' : 'Development'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}; // End of startServer function

// Bootstrap the application
startServer();