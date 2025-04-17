import { Request } from 'express';
import type { Session } from 'express-session';

export interface AuthenticatedRequest extends Request {
  session: Session & {
    userId?: number;
    user?: {
      id: number;
      username: string;
      email: string;
      avatarUrl?: string;
      winning_message?: string;
    };
  };
}
