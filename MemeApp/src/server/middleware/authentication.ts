import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to make session user available in views
 */
export const sessionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.locals.user = req.session?.user || null;
  next();
};

/**
 * Protect routes for signed-in users only
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.session?.userId) {
    // Save the intended URL to redirect back after login
    req.session.returnTo = req.originalUrl;
    req.flash('error', 'You must be logged in to access this page');
    res.redirect('/auth/login');
    return;
  }
  next();
};

/**
 * Restrict routes to guests only (not logged-in users)
 */
export const requireGuest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.log("🛡️ requireGuest check — session.userId:", req.session?.userId);

  if (req.session?.userId) {
    console.log("🚫 Already logged in, redirecting to /");
    return res.redirect('/');
  }

  next();
};
