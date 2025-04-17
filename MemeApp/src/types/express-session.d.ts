import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      username: string;
      email: string;
      avatarUrl?: string;
      winning_message?: string;
    };
    userId?: number;
  }
}

