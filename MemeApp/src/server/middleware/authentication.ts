/**
 * Authentication Middleware
 * This module provides middleware functions for handling user authentication
 * and session management in the application.
 */

import { Request, Response, NextFunction } from 'express';
import 'express-session'; // ensures augmentation is included

/**
 * Custom request interface that extends Express Request
 * Adds typing for session data and flash messages
 *
 * @interface AuthenticatedRequest
 * @extends {Request}
 */
export interface AuthenticatedRequest extends Request {
  flash: {
    (message?: string): { [key: string]: string[] };
    (event: string, message: string | string[]): void;
  };
}

/**
 * Session Middleware
 * Makes the authenticated user's data available to all views/templates
 */
export const sessionMiddleware = (
    request: Request,
    response: Response,
    next: NextFunction
): void => {
    const req = request as AuthenticatedRequest;
    response.locals.user = req.session?.user || null;
    next();
};

/**
 * Protected Route Middleware
 * Ensures that routes can only be accessed by authenticated users
 */
export const requireAuth = (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
): void => {
    if (!request.session?.userId) {
        request.flash('error', 'You must be logged in to access this page');
        return response.redirect('/auth/login');
    }
    next();
};

/**
 * Guest-Only Route Middleware
 * Ensures that certain routes (like login/register) can only be accessed
 * by non-authenticated users
 */
export const requireGuest = (req: Request, res: Response, next: NextFunction) => {
    if (req.session?.userId) {
      return res.redirect('/');
    }
    next();
  };
