// src/services/games.service.ts

import { Server, Socket } from "socket.io";
import { memeTemplates } from '../game/memeTemplates';
import { ScoringSystem } from '../game/scoring';
import { pool } from '../config/database';
import { generateMemeImage } from '../utils/generateMemeImage';
import { io } from "socket.io-client";
import { deleteUnstarredMemes } from '../utils/deleteUnstarredMemes';

export interface MemeSubmission {
    playerId: string;
    username: string;
    captions: {
      text: string;
      top: string;
      left: string;
      fontSize?: string;
      fontFamily?: string;
      color?: string;
    }[];
    imageUrl: string;
    votes: { voterId: string; voteType: 'like' | 'meh' | 'pass' }[];
    bonuses?: {
      name: string;
      points: number;
    }[]; // 👈 add this line
  }
  
export interface MemeTemplate {
    id: string;
    url: string;
    captionFields: number;
}

export interface Round {
    memeTemplates: Record<string, MemeTemplate>; // ✅ per-player templates
    submissions: MemeSubmission[];
    status: 'submitting' | 'voting' | 'results';
    timeLeft: number;
}

export interface Player {
    id: string;
    userId?: number;
    username: string;
    socket: Socket;
    connected?: boolean;
    score: number;
    hasSubmitted?: boolean;
    hasVoted?: boolean;
    currentVoteIndex?: number;
    votingProgress?: number;
    votedOn?: string[];
    avatarUrl?: string;
    rerollsRemaining?: number;
    winning_message?: string;
    disconnectTimeout?: NodeJS.Timeout; // 👈 Add this line
  }
  


export interface Game {
    id: string;
    passcode: string;
    players: Player[];
    status: 'waiting' | 'playing' | 'finished';
    createdAt: Date;
    currentRound: number;
    totalRounds: number;
    roundTime: number; // time in seconds for each submission phase
    votingTime: number; // time in seconds for voting phase
    round?: Round;
    winner?: {
        userId?: number;
        username: string;
        score: number;
        winning_message: string;
    };
    votingIndex?: number; // ⬅ track current meme being voted on
    votingTimer?: NodeJS.Timeout; // ⬅ timeout between memes
    votingInProgress?: boolean;
}


class GamesService {
    private static instance: GamesService;
    private games: Map<string, Game> = new Map();
    private memeTemplates = memeTemplates;
    private timers: Map<string, NodeJS.Timeout> = new Map();

    private constructor() {}

    public static getInstance(): GamesService {
        if (!GamesService.instance) {
            GamesService.instance = new GamesService();
        }
        return GamesService.instance;
    }

    getGame(passcode: string): Game | undefined {
        return this.games.get(passcode);
    }

    getGameById(id: string): Game | undefined {
        return this.games.get(id);
    }

    getAllGames(): Game[] {
        return Array.from(this.games.values());
    }

    updateGame(game: Game): void {
        this.games.set(game.id, game);
        if (game.passcode) {
            this.games.set(game.passcode, game);
        }
    }

    // --------------------------------------------------------------------------------
    // CHANGED: We set game.status = 'playing' immediately and call this.startNewRound
    // --------------------------------------------------------------------------------
    createGame(passcode: string, creator: Player): Game {
        if (!/^\d{4}$/.test(passcode)) {
            throw new Error('Passcode must be exactly 4 digits');
        }
    
        if (this.games.has(passcode)) {
            throw new Error('A game with this passcode already exists');
        }
    
        const game: Game = {
            id: Math.random().toString(36).substring(2, 15),
            passcode,
            players: [
                {
                    ...creator,
                    id: creator.id,
                    connected: true,
                    score: 0,
                },
            ],
            status: 'waiting',         // <<< "waiting" so others can join
            createdAt: new Date(),
            currentRound: 0,
            totalRounds: 1,
            roundTime: 90,
            votingTime: 15,
        };
    
        // Store in the map by both passcode and id
        this.games.set(passcode, game);
        this.games.set(game.id, game);
    
        // Do NOT call startNewRound here. We wait until the host is ready.
    
        return game;
    }

    startGame(passcode: string, io: Server): void {
        const game = this.getGame(passcode);
        if (!game) {
            throw new Error('Game not found');
        }
        if (game.status !== 'waiting') {
            throw new Error('Game has already started or is finished.');
        }
    
        console.log(`Starting game ${game.id} (${passcode})...`);
    
        // ✅ Switch to "playing"
        game.status = 'playing';
        this.updateGame(game);
    
        console.log(`Game ${game.id} status updated to 'playing'. Starting first round...`);
    
        // ✅ Start the first round
        this.startNewRound(game.id, io);
    }
    
    
    

    joinGame(passcode: string, player: Player): Game {
        const game = this.getGame(passcode);
        if (!game) {
            throw new Error('Game not found');
        }   
    
        // Only allow joining if "waiting"
        if (game.status !== 'waiting') {
            throw new Error('Game has already started');
        }
    
        // Could also do size checks, etc.
        if (game.players.length >= 10) {
            throw new Error('Game is full');
        }
    
        // Check if this user is already in
        if (game.players.some((p) => p.userId === player.userId)) {
            throw new Error('Player already in game');
        }
    
        game.players.push({
            ...player,
            // Preserve avatarUrl from player input!
            avatarUrl: player.avatarUrl || '/uploads/avatars/default-avatar.png',
            score: 0,
            hasSubmitted: false,
            hasVoted: false
        });
        
    
        this.updateGame(game);
        return game;
    }
    
    

    async submitMeme(
        gameId: string,
        playerId: string,
        captions: {
          text: string;
          top: string;
          left: string;
          fontSize?: string;
          fontFamily?: string;
          color?: string;
        }[],
        io: Server,
        suppressVotingStart: boolean = false
      ) {
        console.log('[🧠 Captions received]:', captions);
      
        const game = this.getGameById(gameId);
        if (!game) return { success: false, error: 'Game not found' };
      
        console.log('🔍 Looking for player with ID:', playerId);
        console.log('🔍 Available players:', game.players.map(p => p.id));
      
        if (!game.round) return { success: false, error: 'Round is missing' };
        if (game.round.status !== 'submitting') {
          return { success: false, error: 'Not in submission phase' };
        }
      
        const player = game.players.find(p => p.id === playerId);
        if (!player) return { success: false, error: 'Player not found' };
        if (player.hasSubmitted) return { success: false, error: 'Already submitted' };
      
        let imageUrl = '';
        try {
            const playerTemplate = game.round.memeTemplates[player.id];
            imageUrl = await generateMemeImage(playerTemplate.url, captions);
            
        } catch (err) {
          console.error('🛑 Failed to generate meme image:', err);
          return { success: false, error: 'Image generation failed' };
        }
      
        game.round.submissions.push({
          playerId,
          username: player.username,
          captions,
          imageUrl,
          votes: [],
        });
      
        console.log('✅ Submission saved for', player.username, '->', imageUrl);
        player.hasSubmitted = true;
        this.updateGame(game);
      
        // 🧠 All players submitted — begin voting phase
        if (!suppressVotingStart && game.players.every(p => p.hasSubmitted)) {
          game.round.status = 'voting';
          game.round.timeLeft = game.votingTime;
          game.votingIndex = -1;
      
          // ✅ Pre-mark each player's own submission so they never vote on it
          game.players.forEach(player => {
            if (!player.votedOn) player.votedOn = [];
      
            const ownSubmission = game.round?.submissions.find(sub => sub.playerId === player.id);
            if (ownSubmission && !player.votedOn.includes(ownSubmission.playerId)) {
              player.votedOn.push(ownSubmission.playerId);
              console.log(`🤖 Pre-marked own submission ${ownSubmission.playerId} for player ${player.username}`);
            }
          });
      
          // 🚀 Begin shared voting loop
          this.advanceVoting(game, io);
        }
      
        return { success: true, game, imageUrl };
      }
      
      
    
    
    
    
      submitVote(
        gameId: string,
        voterId: string,
        submissionPlayerId: string,
        voteType: 'like' | 'meh' | 'pass',
        io: Server
      ): { success: boolean; error?: string; game?: Game } {
        const game = this.getGameById(gameId);
        if (!game || !game.round) return { success: false, error: 'Game or round not found' };
      
        const round = game.round;
        const voterIndex = game.players.findIndex(p => p.id === voterId);
        if (voterIndex === -1) return { success: false, error: 'Voter not found' };

        const voter = game.players[voterIndex];
        if (!game.players[voterIndex].votedOn) {
            game.players[voterIndex].votedOn = [];
        }

      
        const submission = round.submissions.find(s => String(s.playerId) === String(submissionPlayerId));
        if (!submission) return { success: false, error: 'Submission not found' };
        if (String(submission.playerId) === String(voterId)) return { success: false, error: 'Cannot vote on own submission' };
        if (voter.votedOn!.includes(String(submissionPlayerId))) return { success: false, error: 'Already voted on this submission' };
      
        submission.votes.push({ voterId: voter.id, voteType }); // ✅ Use in-game player ID
      
        // 🛠️ FIX: Properly track who this voter has voted on
        voter.votedOn!.push(String(submissionPlayerId));
      
        console.log(`📝 Updated votedOn for ${voter.username} (${voter.id}):`, voter.votedOn);
        /*
        if (this.areAllPlayersDoneVoting(game)) {
          console.log(`✅ All players finished voting in game ${game.id}`);
          this.endRound(game, io);
        }
        */
      
        return { success: true, game };
      }
      
      
      
      
      
    
    
    
    
    
      handleVoteSubmission(
        socket: Socket,
        data: { gameId: string; submissionPlayerId: string; voteType: 'like' | 'meh' | 'pass' },
        io: Server
    ): { success: boolean; error?: string } {
        const { gameId, submissionPlayerId, voteType } = data;
        const game = this.getGameById(gameId);
        if (!game || !game.round) {
            return { success: false, error: 'Game or round not found' };
        }
    
        const voterId = socket.data.userId?.toString();
        if (!voterId) {
            return { success: false, error: 'Unauthorized user' };
        }
    
        const submission = game.round.submissions.find(s => s.playerId === submissionPlayerId);
        if (!submission) {
            return { success: false, error: 'Submission not found' };
        }
    
        if (submission.playerId === voterId) {
            console.warn(`⚠️ Player ${voterId} tried to vote on their own meme. Ignored.`);
            return { success: false, error: 'Cannot vote on own submission' };
        }
    
        if (submission.votes.find(v => v.voterId === voterId)) {
            return { success: false, error: 'Already voted on this submission' };
        }
    
        submission.votes.push({ voterId, voteType });
        console.log(`📊 Current votes on ${submissionPlayerId}:`, submission.votes);
    
        // ✅ Update the correct voter's votedOn list
        const voter = game.players.find(p => String(p.userId) === voterId || String(p.id) === voterId);
        if (voter) {
            if (!voter.votedOn) voter.votedOn = [];
            if (!voter.votedOn.includes(submissionPlayerId)) {
                voter.votedOn.push(submissionPlayerId);
                console.log(`✅ Updated votedOn for ${voter.username} (${voter.id}):`, voter.votedOn);
            }
        }
    
        const totalVoters = game.players.filter(p => String(p.id) !== submissionPlayerId).length;
        const totalVotes = submission.votes.length;
        console.log(`🧮 Submission ${submissionPlayerId} has ${totalVotes}/${totalVoters} votes`);
    
        // ✅ Check if all players are done voting
        const allDone = game.players.every(player => {
            const playerIdStr = String(player.id);
            const others = game.round!.submissions.filter(s => String(s.playerId) !== playerIdStr);
            const voted = player.votedOn ?? [];
            const stillLeft = others.filter(s => !voted.includes(String(s.playerId)));
            console.log(`🔍 Player ${player.username} (${player.id}) has ${stillLeft.length} remaining votes`);
            return stillLeft.length === 0;
        });
        /*
        if (allDone) {
            console.log(`✅ All votes submitted in game ${game.id}. Ending round...`);
            this.endRound(game, io);
        }
        */
        this.updateGame(game);
        return { success: true };
    }
    
    
    
    

      getNextVotableSubmission(game: Game, player: Player): MemeSubmission | null {
        if (!game.round) return null;
    
        const submissions = game.round.submissions;
    
        const validSubmissions = submissions.filter(s =>
            s.playerId !== player.id &&
            !s.votes.some(v => v.voterId === player.id)
        );
    
        const index = player.currentVoteIndex || 0;
        return validSubmissions[index] || null;
    }
    
    
    
    
    
    
    
    
    startNewRound(gameId: string, io: Server): void {
        const game = this.getGameById(gameId);
        (game as any).resultsEmitted = false;
        if (!game) throw new Error('Game not found');
    
        game.currentRound++;
        (game as any).resultsEmitted = false;
        (game as any).nextRoundStarted = false;
        game.round = {
            memeTemplates: {}, // empty map to start
            submissions: [],
            status: 'submitting',
            timeLeft: game.roundTime,
        };
          

    
        // Ensure game.round is initialized
        if (!game.round) {
            console.log(`⚠️ Game ${gameId} has no round data. Initializing a new round.`);
            game.round = {
                memeTemplates: {}, // empty map to start
                submissions: [],
                status: 'submitting',
                timeLeft: game.roundTime,
            };
        }
    
        // ✅ Select a random meme template
        const memeTemplates: Record<string, MemeTemplate> = {};
        game.players.forEach((player) => {
            const randomTemplate = this.memeTemplates[Math.floor(Math.random() * this.memeTemplates.length)];
            memeTemplates[player.id] = randomTemplate;
        });

        game.round.memeTemplates = memeTemplates;

          

    
        // ✅ Reset player submission and voting state
        game.players.forEach((player) => {
            player.hasSubmitted = false;
            player.hasVoted = false;
            player.votingProgress = 0;
            player.currentVoteIndex = 0;
            player.votedOn = []; // ✅ Important: Reset votes per round
            player.rerollsRemaining = 3;
        });
    
        console.log(`🚀 Game ${gameId} is now in 'submitting' phase.`);
    
        this.updateGame(game);
    
        // ✅ Emit full game state to all clients
        game.players.forEach((player) => {
            console.log(`📡 Sending 'game_state' update to player ${player.username}`);
            player.socket.emit('game_state', {
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
                        memeUrl: s.imageUrl,
                        votes: s.votes.length,
                        avatarUrl: player?.avatarUrl || '/uploads/avatars/default-avatar.png'
                    }))
                })
            });
        });
    
        this.startTimer(game, io);
    }

    private advanceVoting(game: Game, io: Server) {
        if (!game.round || !game.round.submissions.length) return;
        if (game.votingInProgress) return;
    
        game.votingInProgress = true;
        clearTimeout(game.votingTimer);
    
        game.votingIndex = (game.votingIndex ?? -1) + 1;
    
        // ✅ All memes have been shown — WAIT for last meme to display before ending
        if (game.votingIndex >= game.round.submissions.length) {
            console.log("🏁 All memes have been shown. Waiting final timeout before results...");
            return;
        }
    
        const current = game.round.submissions[game.votingIndex];

        console.log(`⬆️ Emitting voting_submission for index ${game.votingIndex}:`, current.imageUrl);
        game.round.timeLeft = game.votingTime; // ✅ FIXED: use configured time


        // ✅ Send immediate timer update to reset frontend timer bar
        game.players.forEach((player) => {
            player.socket.emit('time_update', {
                timeLeft: game.round!.timeLeft,
                phase: game.round!.status, // should be 'voting'
            });
        });

        io.to(`game:${game.id}`).emit('voting_submission', {
            template: game.round.memeTemplates,
            submission: {
                playerId: String(current.playerId),
                username: current.username,
                imageUrl: current.imageUrl,
            },
            timeLeft: game.round.timeLeft,
        });
    
        game.votingTimer = setTimeout(() => {
            game.votingInProgress = false;
        
            // If this was the last meme
            if (game.votingIndex! + 1 >= game.round!.submissions.length) {
                console.log("✅ Final meme timeout complete. Now ending round...");
        
                game.players.forEach(p => p.socket.emit('voting_phase_ended'));
                this.endRound(game, io); // ✅ Let endRound handle everything else
            } else {
                this.advanceVoting(game, io); // ⏭️ Continue to next meme
            }
        }, game.votingTime * 1000);
    }
    
    
    
    
    
    
    private getVoteableSubmissionsForPlayer(game: Game, playerId: string): MemeSubmission[] {
        const normalizedPlayerId = String(playerId);
    
        const player = game.players.find(p =>
            String(p.id) === normalizedPlayerId ||
            String(p.userId) === normalizedPlayerId
        );
    
        if (!player) {
            console.warn(`⚠️ Player not found in getVoteableSubmissionsForPlayer: ${normalizedPlayerId}`);
            return [];
        }
    
        if (!game.round) {
            console.warn(`⚠️ No round data available for voteable submission check`);
            return [];
        }
    
        if (!player.votedOn) {
            player.votedOn = [];
        }
    
        console.log(`🔎 Checking voteable submissions for ${player.username} (${normalizedPlayerId})`);
        console.log(`➡️ votedOn:`, player.votedOn);
    
        return game.round.submissions.filter(sub => {
            const submissionOwnerId = String(sub.playerId);
            const isOwn = submissionOwnerId === String(player.userId); // 🔑 use userId here
            const alreadyVoted = player.votedOn!.includes(submissionOwnerId);
            const voteable = !isOwn && !alreadyVoted;
    
            console.log(`🧪 Submission ${submissionOwnerId}: Own=${isOwn}, AlreadyVoted=${alreadyVoted}, Voteable=${voteable}`);
            return voteable;
        });
    }
    
    
      
      
      
      
    
    private areAllPlayersDoneVoting(game: Game): boolean {
        if (!game.round) return false;
    
        return game.players.every((player) => {
            const remaining = this.getVoteableSubmissionsForPlayer(game, String(player.id));
            console.log(`🔍 Player ${player.id} has ${remaining.length} remaining votes`);
            console.log(`👀 Player ${player.username} (${player.id}) has ${remaining.length} voteable submissions left`);
            return remaining.length === 0;
        });
    }
    
    private sanitizeGameForPlayer(game: Game, playerId: string): any {
        return {
            id: game.id,
            status: game.status,
            currentRound: game.currentRound,
            totalRounds: game.totalRounds,
            round: {
                status: game.round?.status,
                memeTemplate: game.round?.memeTemplates[playerId],
                submissions: game.round?.submissions.map(sub => ({
                    playerId: sub.playerId,
                    username: sub.username,
                    captions: sub.captions,
                    votes: sub.votes.length, // you can choose to hide vote details here
                }))
            },
            players: game.players.map((p: Player) => ({
                id: p.id,
                username: p.username,
                score: p.score,
                connected: p.connected,
                hasSubmitted: p.hasSubmitted,
                hasVoted: p.hasVoted,
                avatarUrl: p.avatarUrl || '/uploads/avatars/default-avatar.png', // ✅ Must include this
                winning_message: p.winning_message
              }))
        };
    }
    
    

    private async endRound(game: Game, io: Server): Promise<void> {
        console.log("🏁 Ending round, calculating scores...");
        if (!game.round) return;
    
        if ((game as any).resultsEmitted) return;
        (game as any).resultsEmitted = true;
    
        this.clearTimer(game.id);
        game.votingInProgress = false;
    
        game.round.status = 'results';
        game.round.timeLeft = 30;
        this.startTimer(game, io); // ✅ Make sure this is called after setting status + timeLeft
    
        // ✅ Scoring
        game.round.submissions.forEach((submission) => {
            const player = game.players.find((p) => String(p.id) === String(submission.playerId));
            if (!player) {
                console.warn(`❌ No matching player found for submission.playerId: ${submission.playerId}`);
            } else {
                console.log(`✅ Matched player ${player.username} (${player.id}) to submission`);
            }
            if (player) {
                const isFirstSubmission = game.round!.submissions[0].playerId === player.id;
                const wasLastPlace = game.currentRound > 1 &&
                    game.players.filter(p => p.id !== player.id).every(p => p.score > player.score);
                const winStreak = this.calculateWinStreak(game, player.id);
    
                const scoreResult = ScoringSystem.calculateScore({
                    playerId: submission.playerId,
                    votes: submission.votes,
                }, game.players.length, isFirstSubmission, wasLastPlace, winStreak);
    
                player.score += scoreResult.points;
                console.log(`🧾 Final score for ${player.username} (${player.id}) → ${player.score}`);
                submission.bonuses = scoreResult.bonuses;
    
                console.log(`📨 Emitting score_update to ${player.username} (${player.id}) → ${player.score} pts`);
    
                player.socket.emit('score_update', {
                    points: scoreResult.points,
                    bonuses: scoreResult.bonuses,
                    totalScore: player.score,
                });
                console.log('📥 Processing submission:');
                console.log('   → submission.playerId:', submission.playerId);
                console.log('   → submission.username:', submission.username);
                console.log('   → votes:', submission.votes);
                console.log('   → players in game:', game.players.map(p => ({ id: p.id, username: p.username })));

            }
        });
    
        // ✅ Send results
        const resultPayload = game.round.submissions.map(sub => ({
            playerId: sub.playerId,
            username: sub.username,
            captions: sub.captions,
            votes: {
                like: sub.votes.filter(v => v.voteType === 'like').length,
                meh: sub.votes.filter(v => v.voteType === 'meh').length,
                pass: sub.votes.filter(v => v.voteType === 'pass').length,
            },
            imageUrl: sub.imageUrl,
            templateUrl: game.round!.memeTemplates?.[sub.playerId]?.url || '',
            bonuses: sub.bonuses || [],
        }));
    
        console.log("📤 Emitting round_results to all players:", resultPayload);
        game.players.forEach(player => {
            player.socket.emit('game_state', {
                ...this.sanitizeGameForPlayer(game, player.id),
                me: { id: player.id }, // ✅ Ensure this exists
              });
        });
        game.players.forEach(player => {
            player.socket.emit('round_results', { results: resultPayload });
        });
    
        // ✅ Handle game over vs. next round
        if (game.currentRound >= game.totalRounds) {
            console.log("🎉 Final round reached — scheduling game over screen...");
            setTimeout(async () => {
                game.status = 'finished';
    
                const rankings = ScoringSystem.calculateFinalRankings(
                    game.players.map((p) => ({
                        id: p.id,
                        score: p.score,
                        username: p.username,
                        winning_message: p.winning_message
                    }))
                );
    
                const winner = rankings[0];
                game.winner = {
                    userId: game.players.find((p) => p.id === winner.id)?.userId,
                    username: winner.username,
                    score: winner.score,
                    winning_message: winner.winning_message || '' // ← force a string fallback
                  };


                // ✅ Update user stats in DB
                for (const player of game.players) {
                    const isWinner = player.id === winner.id;
                    try {
                        await pool.query(`
                            UPDATE users SET 
                                games_played = games_played + 1,
                                total_points = total_points + $1,
                                highest_score = GREATEST(highest_score, $1),
                                games_won = games_won + $2,
                                current_win_streak = CASE 
                                    WHEN $2 = 1 THEN current_win_streak + 1 
                                    ELSE 0 
                                END
                            WHERE id = $3
                        `, [player.score, isWinner ? 1 : 0, player.userId]);
                    } catch (err) {
                        console.error(`❌ Failed to update stats for ${player.username}`, err);
                    }
                }
    
                game.players.forEach((player) => {
                    player.socket.emit('game_rankings', { rankings });
                    player.socket.emit('game_state', {
                        ...this.sanitizeGameForPlayer(game, player.id),
                        me: { id: player.id }, // ✅ Ensure this exists
                      });
                });
    
                this.updateGame(game);
            }, 30000);
            return;
        }
    
        // ✅ Else: wait 30s then start next round
        console.log(`⏱️ Waiting 30 seconds before starting next round for game ${game.id}...`);
        setTimeout(() => {
            this.startNewRound(game.id, io);
        }, 30000);
    
        this.updateGame(game);
    }
    
    
    
    
    
    
    

    private calculateWinStreak(game: Game, playerId: string): number {
        let streak = 0;
        for (let round = game.currentRound; round > 0; round--) {
            const roundWinner = this.getRoundWinner(game, round);
            if (roundWinner?.id === playerId) {
                streak++;
            } else {
                break;
            }
        }
        return streak;
    }

    private getRoundWinner(game: Game, roundNumber: number): Player | null {
        if (!game.round || game.currentRound !== roundNumber) return null;

        const submissions = game.round.submissions;
        if (submissions.length === 0) return null;

        const winningSubmission = submissions.reduce((prev, current) =>
            current.votes.length > prev.votes.length ? current : prev
        );

        return (
            game.players.find((p) => p.id === winningSubmission.playerId) ||
            null
        );
    }

    private startTimer(game: Game, io: Server): void {
        this.clearTimer(game.id);
    
        const timer = setInterval(async () => {
            const currentGame = this.getGameById(game.id);
            if (!currentGame || !currentGame.round) {
                this.clearTimer(game.id);
                return;
            }
    
            currentGame.round.timeLeft--;
    
            currentGame.players.forEach((player: Player) => {
                player.socket.emit('time_update', {
                    timeLeft: currentGame.round!.timeLeft,
                    phase: currentGame.round!.status,
                });
            });
    
            // ✅ Auto-submit if needed during submitting phase
            if (currentGame.round.timeLeft <= 0 && currentGame.round.status === 'submitting') {
                for (const player of currentGame.players) {
                    if (!player.hasSubmitted) {
                        const result = await this.submitMeme(
                            currentGame.id,
                            player.id,
                            [{ text: ' ', top: '20%', left: '10%' }],
                            io,
                            true
                        );
                        console.log('🤖 Auto-submission result for', player.username, ':', result);
                    }
                }
    
                currentGame.round.status = 'voting';
                currentGame.players.forEach((player) => {
                    player.hasVoted = false;
                    player.currentVoteIndex = 0;
                });
    
                currentGame.votingIndex = -1;
                currentGame.votingInProgress = false;
                this.advanceVoting(currentGame, io);
            }
    
            // ✅ Let `endRound()` handle starting the next round
            this.updateGame(currentGame);
        }, 1000);
    
        this.timers.set(game.id, timer);
    }
    
    
    
    
    
      
      
      
    
    
    

    private clearTimer(gameId: string): void {
        const timer = this.timers.get(gameId);
        if (timer) {
            clearInterval(timer);
            this.timers.delete(gameId);
        }
    }

    public cleanupGame(gameId: string): void {
        this.clearTimer(gameId);

        const game = this.getGameById(gameId);
        if (!game) return;

        // 🧼 Delete unstarred memes
        deleteUnstarredMemes(gameId).catch(err => {
            console.error(`❌ Error cleaning up memes for ${gameId}:`, err);
        });

        // Notify all players the game is ending
        game.players.forEach((player) => {
            player.socket.emit('game_cleanup', {
                message: 'Game session ended',
                gameId: game.id,
            });
        });

        // Remove game from storage
        this.games.delete(game.id);
        if (game.passcode) {
            this.games.delete(game.passcode);
        }
    }


    rerollTemplate(gameId: string, playerId: string): {
        success: boolean;
        newTemplate?: MemeTemplate;
        remaining?: number;
        error?: string;
      } {
        const game = this.getGameById(gameId);
        if (!game || !game.round) return { success: false, error: 'Game or round not found' };
      
        const player = game.players.find(p => p.id === playerId);
        if (!player) return { success: false, error: 'Player not found' };
      
        if (player.rerollsRemaining === undefined || player.rerollsRemaining <= 0) {
          return { success: false, error: 'No rerolls remaining' };
        }
      
        // 🎲 Choose a new template
        const newTemplate = this.memeTemplates[Math.floor(Math.random() * this.memeTemplates.length)];
        game.round.memeTemplates[player.id] = newTemplate;
        player.rerollsRemaining--;
      
        this.updateGame(game);
      
        return {
            success: true,
            newTemplate,
            remaining: player.rerollsRemaining,
          };          
    }
      

    handlePlayerDisconnect(gameId: string, playerId: string): void {
        const game = this.getGameById(gameId);
        if (!game) return;

        const player = game.players.find((p) => p.id === playerId);
        if (!player) return;

        player.connected = false;

        // Notify other players about the disconnection
        game.players.forEach((p) => {
            if (p.id !== playerId) {
                p.socket.emit('player_disconnected', {
                    playerId,
                    username: player.username,
                });
            }
        });

        // Check if all players are disconnected
        const allDisconnected = game.players.every((p) => !p.connected);
        if (allDisconnected) {
            this.cleanupGame(gameId);
        } else {
            this.updateGame(game);
        }
    }

    handlePlayerReconnect(
        gameId: string,
        playerId: string,
        socket: Socket
    ): void {
        const game = this.getGameById(gameId);
        if (!game) return;

        const player = game.players.find((p) => p.id === playerId);
        if (!player) return;

        player.connected = true;
        player.socket = socket;

        // Send current game state to reconnected player
        if (game.round) {
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

        // Notify other players about the reconnection
        game.players.forEach((p) => {
            if (p.id !== playerId) {
                p.socket.emit('player_reconnected', {
                    playerId,
                    username: player.username,
                });
            }
        });

        this.updateGame(game);
    }

    createRematch(game: Game): Game {
        const newGame = this.createGame(
            Math.floor(1000 + Math.random() * 9000).toString(),
            game.players[0]
        );

        // Add the rest of the players
        for (let i = 1; i < game.players.length; i++) {
            this.joinGame(newGame.passcode, game.players[i]);
        }

        return newGame;
    }

    private serializeGame(game: Game): string {
        const serializedGame = {
            ...game,
            players: game.players.map((player) => ({
                ...player,
                socket: undefined, // remove socket instance
            })),
        };
        return JSON.stringify(serializedGame);
    }

    private deserializeGame(
        gameData: string,
        sockets: Map<string, Socket>
    ): Game {
        const parsedGame = JSON.parse(gameData);

        const game = {
            ...parsedGame,
            players: parsedGame.players.map((player: Omit<Player, 'socket'>) => ({
                ...player,
                socket: sockets.get(player.id) || null,
            })),
        };

        return game;
    }

    async saveGameState(gameId: string): Promise<void> {
        const game = this.getGameById(gameId);
        if (!game) return;

        try {
            const serializedGame = this.serializeGame(game);
            await pool.query(
                `INSERT INTO game_states (game_id, state_data, created_at)
                 VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (game_id) 
                 DO UPDATE SET state_data = $2, updated_at = CURRENT_TIMESTAMP`,
                [gameId, serializedGame]
            );
        } catch (error) {
            console.error('Failed to save game state:', error);
        }
    }

    async loadGameState(
        gameId: string,
        sockets: Map<string, Socket>
    ): Promise<Game | null> {
        try {
            const result = await pool.query(
                'SELECT state_data FROM game_states WHERE game_id = $1',
                [gameId]
            );

            if (result.rows.length === 0) return null;

            return this.deserializeGame(result.rows[0].state_data, sockets);
        } catch (error) {
            console.error('Failed to load game state:', error);
            return null;
        }
    }

    private async saveGameStatistics(game: Game): Promise<void> {
        if (game.status !== 'finished' || !game.winner) return;

        try {
            await pool.query('BEGIN');

            // Update player statistics
            for (const player of game.players) {
                const isWinner = player.userId === game.winner.userId;
                await pool.query(
                    `INSERT INTO player_statistics 
                     (user_id, games_played, games_won, total_points, highest_score)
                     VALUES ($1, 1, $2, $3, $4)
                     ON CONFLICT (user_id)
                     DO UPDATE SET
                        games_played = player_statistics.games_played + 1,
                        games_won = player_statistics.games_won + $2,
                        total_points = player_statistics.total_points + $3,
                        highest_score = GREATEST(player_statistics.highest_score, $4)`,
                    [player.userId, isWinner ? 1 : 0, player.score, player.score]
                );
            }

            // Save game result
            await pool.query(
                `INSERT INTO game_results
                 (game_id, winner_id, total_rounds, duration_seconds, player_count)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    game.id,
                    game.winner.userId,
                    game.totalRounds,
                    Math.floor(
                        (Date.now() - game.createdAt.getTime()) / 1000
                    ),
                    game.players.length,
                ]
            );

            await pool.query('COMMIT');
        } catch (error) {
            await pool.query('ROLLBACK');
            console.error('Failed to save game statistics:', error);
        }
    }

    private async getPlayerStatistics(userId: number): Promise<any> {
        try {
            const result = await pool.query(
                `SELECT 
                    games_played,
                    games_won,
                    total_points,
                    highest_score,
                    ROUND(CAST(games_won AS DECIMAL) / NULLIF(games_played, 0) * 100, 2) as win_rate
                 FROM player_statistics
                 WHERE user_id = $1`,
                [userId]
            );

            return result.rows[0] || null;
        } catch (error) {
            console.error('Failed to get player statistics:', error);
            return null;
        }
    }

    private async getLeaderboard(limit: number = 10): Promise<any[]> {
        try {
            const result = await pool.query(
                `SELECT 
                    u.username,
                    ps.games_played,
                    ps.games_won,
                    ps.total_points,
                    ps.highest_score,
                    ROUND(CAST(ps.games_won AS DECIMAL) / NULLIF(ps.games_played, 0) * 100, 2) as win_rate
                 FROM player_statistics ps
                 JOIN users u ON u.id = ps.user_id
                 ORDER BY ps.total_points DESC, ps.games_won DESC
                 LIMIT $1`,
                [limit]
            );

            return result.rows;
        } catch (error) {
            console.error('Failed to get leaderboard:', error);
            return [];
        }
    }
}

export const gamesService = GamesService.getInstance();
