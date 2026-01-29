import bcrypt from "bcrypt";
import session from "express-session";
import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users, authTokens } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || "rewired-session-secret-change-in-production";
  
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true, // Required for sameSite: "none" and HTTPS
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: "none", // Allow cross-origin requests from mobile app
      },
    })
  );

  // Register new user (signup)
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      // Check if email exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(password);
      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          password: hashedPassword,
          name: name,
        })
        .returning();

      // Generate auth token for mobile apps
      const authToken = await generateAuthToken(newUser.id);
      
      // Set session and save explicitly
      req.session.userId = newUser.id;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      res.json({
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          hasVoiceSample: newUser.hasVoiceSample,
        },
        authToken, // Token for mobile apps
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Generate auth token for mobile apps
      const authToken = await generateAuthToken(user.id);
      
      // Set session and save explicitly
      req.session.userId = user.id;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          hasVoiceSample: user.hasVoiceSample,
        },
        authToken, // Token for mobile apps
      });
    } catch (error: any) {
      console.error("Login error:", error?.message || error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // Get current user
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId));

      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "User not found" });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          hasVoiceSample: user.hasVoiceSample,
          voiceId: user.voiceId,
        },
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });
}

// Generate auth token for mobile apps (stored in database for persistence)
export async function generateAuthToken(userId: string): Promise<string> {
  // Check if user already has a valid token in database
  const existingTokens = await db
    .select()
    .from(authTokens)
    .where(and(
      eq(authTokens.userId, userId),
      gt(authTokens.expiresAt, new Date())
    ))
    .limit(1);

  if (existingTokens.length > 0) {
    // Extend existing token expiry
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db
      .update(authTokens)
      .set({ expiresAt: newExpiry })
      .where(eq(authTokens.token, existingTokens[0].token));
    console.log("Reusing existing token for user:", userId);
    return existingTokens[0].token;
  }
  
  // Create new token
  const token = Math.random().toString(36).substring(2) + 
                Math.random().toString(36).substring(2) + 
                Date.now().toString(36);
  
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  await db.insert(authTokens).values({
    token,
    userId,
    expiresAt,
  });
  
  console.log("Created new token for user:", userId);
  return token;
}

// Verify auth token (from database)
export async function verifyAuthToken(token: string): Promise<string | null> {
  const results = await db
    .select()
    .from(authTokens)
    .where(and(
      eq(authTokens.token, token),
      gt(authTokens.expiresAt, new Date())
    ))
    .limit(1);

  if (results.length === 0) {
    console.log("Token not found or expired:", token.substring(0, 10) + "...");
    return null;
  }
  
  console.log("Token verified for user:", results[0].userId);
  return results[0].userId;
}

// Invalidate auth token (for logout)
export async function invalidateAuthToken(token: string): Promise<void> {
  await db.delete(authTokens).where(eq(authTokens.token, token));
}

// Async middleware wrapper for Express
function asyncMiddleware(fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Middleware to require authentication
async function requireAuthAsync(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  // First try session-based auth (works on web)
  if (req.session.userId) {
    req.userId = req.session.userId;
    next();
    return;
  }
  
  // Fallback to token-based auth (works on mobile)
  const authToken = req.header("X-Auth-Token");
  if (authToken) {
    try {
      const userId = await verifyAuthToken(authToken);
      if (userId) {
        req.userId = userId;
        next();
        return;
      }
    } catch (error) {
      console.error("Token verification error:", error);
    }
  }
  
  res.status(401).json({ error: "Authentication required" });
}

// Export wrapped version for use as middleware
export const requireAuth = asyncMiddleware(requireAuthAsync);

// Optional auth - sets userId if logged in but doesn't require it
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.session.userId) {
    req.userId = req.session.userId;
  }
  next();
}
