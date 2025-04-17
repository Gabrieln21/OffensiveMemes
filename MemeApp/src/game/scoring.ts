/**
 * Scoring System for Meme Battle Game
 * Handles calculation of points based on votes and special bonuses
 */

export interface VoteResult {
    playerId: string;
    votes: { voterId: string; voteType: 'like' | 'meh' | 'pass' }[];
}

export interface ScoringResult {
    points: number;
    bonuses: {
        name: string;
        points: number;
    }[];
}

export class ScoringSystem {
    // Base points for each vote received
    private static readonly BASE_VOTE_POINTS = 100;

    // Bonus points for special achievements
    private static readonly BONUSES = {
        UNANIMOUS: {
            name: 'Unanimous Victory',
            points: 100,
            description: 'Everyone voted for your meme!'
        },
        FIRST_SUBMISSION: {
            name: 'Speed Demon',
            points: 25,
            description: 'First to submit a meme'
        },
        STREAK: {
            name: 'Hot Streak',
            points: 50,
            description: 'Won multiple rounds in a row'
        }
    };

    /**
     * Calculate points for a submission based on votes and context
     */
    static calculateScore(
        submission: VoteResult,
        totalPlayers: number,
        isFirstSubmission: boolean,
        wasLastPlace: boolean,
        winStreak: number
    ): ScoringResult {
        const result: ScoringResult = {
            points: 0,
            bonuses: []
        };

        // Base points from votes
        let votePoints = 0;
        submission.votes.forEach(v => {
        if (v.voteType === 'like') votePoints += 100;
        else if (v.voteType === 'meh') votePoints += 10;
        else if (v.voteType === 'pass') votePoints += -50;
        });
        result.points += votePoints;

        // Check for unanimous victory
        // Only award Unanimous Victory if there are at least 3 players
        if (totalPlayers >= 3 && submission.votes.length === totalPlayers - 1) {
            result.points += this.BONUSES.UNANIMOUS.points;
            result.bonuses.push({
            name: this.BONUSES.UNANIMOUS.name,
            points: this.BONUSES.UNANIMOUS.points,
            });
        }
  

        // First submission bonus
        if (isFirstSubmission) {
            result.points += this.BONUSES.FIRST_SUBMISSION.points;
            result.bonuses.push({
                name: this.BONUSES.FIRST_SUBMISSION.name,
                points: this.BONUSES.FIRST_SUBMISSION.points
            });
        }

        // Comeback bonus
        /*
        if (wasLastPlace) {
            result.points += this.BONUSES.COMEBACK.points;
            result.bonuses.push({
                name: this.BONUSES.COMEBACK.name,
                points: this.BONUSES.COMEBACK.points
            });
        }
        */

        // Win streak bonus
        if (winStreak > 1) {
            const streakPoints = this.BONUSES.STREAK.points * winStreak;
            result.points += streakPoints;
            result.bonuses.push({
                name: `${this.BONUSES.STREAK.name} x${winStreak}`,
                points: streakPoints
            });
        }

        return result;
    }

    /**
     * Calculate final game rankings
     */
    static calculateFinalRankings(players: Array<{ id: string; score: number; username: string; winning_message?: string }>) {
        return players
            .sort((a, b) => b.score - a.score)
            .map((player, index) => ({
                ...player,
                rank: index + 1,
                title: this.getRankTitle(index)
            }));
    }

    /**
     * Get a fun title based on final ranking
     */
    private static getRankTitle(rank: number): string {
        const titles = [
            'Meme Lord',
            'Dank Master',
            'Meme Apprentice',
            'Casual Memer',
            'Meme Enthusiast',
            'Needs More JPG',
            'Keep Practicing',
            'At Least You Tried'
        ];
        return titles[Math.min(rank, titles.length - 1)];
    }
}