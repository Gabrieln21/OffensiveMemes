import session from 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    returnTo?: string;
    user?: {
      id: number;
      username: string;
      email: string;
      avatarUrl?: string;
      winning_message?: string;
    };
  }
}