import bcrypt from "bcrypt";
import session from "express-session";
import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

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
      const authToken = generateAuthToken(newUser.id);
      
      // Set session and save explicitly
      req.session.userId = newUser.id;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to save session" });
        }
        
        res.json({
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            hasVoiceSample: newUser.hasVoiceSample,
          },
          authToken, // Token for mobile apps
        });
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
      const authToken = generateAuthToken(user.id);
      
      // Set session and save explicitly
      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to save session" });
        }
        
        res.json({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            hasVoiceSample: user.hasVoiceSample,
          },
          authToken, // Token for mobile apps
        });
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

// Store for auth tokens (in production, use Redis or JWT)
const authTokens = new Map<string, { userId: string; expires: number }>();

// Generate auth token for mobile apps (long-lived)
export function generateAuthToken(userId: string): string {
  // Check if user already has a valid token
  for (const [token, data] of authTokens.entries()) {
    if (data.userId === userId && Date.now() < data.expires) {
      // Extend existing token
      data.expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
      return token;
    }
  }
  
  // Create new token
  const token = Math.random().toString(36).substring(2) + 
                Math.random().toString(36).substring(2) + 
                Date.now().toString(36);
  authTokens.set(token, {
    userId,
    expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  return token;
}

// Verify auth token
export function verifyAuthToken(token: string): string | null {
  const data = authTokens.get(token);
  if (!data) return null;
  if (Date.now() > data.expires) {
    authTokens.delete(token);
    return null;
  }
  return data.userId;
}

// Invalidate auth token (for logout)
export function invalidateAuthToken(token: string): void {
  authTokens.delete(token);
}

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of authTokens.entries()) {
    if (now > data.expires) {
      authTokens.delete(token);
    }
  }
}, 60000);

// Middleware to require authentication
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // First try session-based auth (works on web)
  if (req.session.userId) {
    req.userId = req.session.userId;
    return next();
  }
  
  // Fallback to token-based auth (works on mobile)
  const authToken = req.header("X-Auth-Token");
  console.log("Auth check - Token header:", authToken ? authToken.substring(0, 10) + "..." : "missing");
  if (authToken) {
    const userId = verifyAuthToken(authToken);
    console.log("Auth check - User ID from token:", userId);
    if (userId) {
      req.userId = userId;
      return next();
    }
  }
  
  return res.status(401).json({ error: "Authentication required" });
}

// Optional auth - sets userId if logged in but doesn't require it
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.session.userId) {
    req.userId = req.session.userId;
  }
  next();
}
