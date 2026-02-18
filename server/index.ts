import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";
import { pool } from "./db";

const app = express();
const SERVER_VERSION = "1.8.0";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function timestamp(): string {
  return new Date().toISOString();
}

function logInfo(component: string, message: string, data?: Record<string, unknown>) {
  const entry = {
    level: "INFO",
    ts: timestamp(),
    component,
    message,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

function logWarn(component: string, message: string, data?: Record<string, unknown>) {
  const entry = {
    level: "WARN",
    ts: timestamp(),
    component,
    message,
    ...data,
  };
  console.warn(JSON.stringify(entry));
}

function logError(component: string, message: string, data?: Record<string, unknown>) {
  const entry = {
    level: "ERROR",
    ts: timestamp(),
    component,
    message,
    ...data,
  };
  console.error(JSON.stringify(entry));
}

function setupProcessHandlers() {
  process.on("uncaughtException", (err) => {
    logError("process", "Uncaught exception — server staying alive", {
      error: err.message,
      stack: err.stack,
    });
  });

  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    logError("process", "Unhandled promise rejection — server staying alive", {
      error: message,
      stack,
    });
  });

  logInfo("process", "Process-level error handlers installed");
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}:5000`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
        origins.add(`https://${d.trim()}:5000`);
      });
    }

    const origin = req.header("origin");

    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    const isMobileApp = !origin && req.path.startsWith("/api/");

    if (isMobileApp || (origin && (origins.has(origin) || isLocalhost))) {
      if (origin) {
        res.header("Access-Control-Allow-Origin", origin);
      } else {
        res.header("Access-Control-Allow-Origin", "*");
      }
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS, PATCH",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Auth-Token");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupSecurityHeaders(app: express.Application) {
  app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(self), camera=()");
    
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https:",
      "media-src 'self' blob: data:",
      "frame-ancestors 'self'",
    ].join("; ");
    res.setHeader("Content-Security-Policy", csp);
    
    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;

    const originalResJson = res.json;
    let capturedStatus: number | undefined;

    res.json = function (bodyJson, ...args) {
      capturedStatus = res.statusCode;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!reqPath.startsWith("/api")) return;

      const duration = Date.now() - start;
      const status = capturedStatus || res.statusCode;
      const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";

      const entry: Record<string, unknown> = {
        level,
        ts: timestamp(),
        component: "http",
        method: req.method,
        path: reqPath,
        status,
        duration_ms: duration,
      };

      if (status >= 400) {
        entry.ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
        entry.user_agent = req.headers["user-agent"]?.substring(0, 120) || "unknown";
      }

      if (status >= 500) {
        console.error(JSON.stringify(entry));
      } else if (status >= 400) {
        console.warn(JSON.stringify(entry));
      } else {
        console.log(JSON.stringify(entry));
      }
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, req: Request, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const forwardedProto = req.header("x-forwarded-proto") || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host") || req.get("host");
  const currentBaseUrl = `${forwardedProto}://${forwardedHost}`;

  let manifest = fs.readFileSync(manifestPath, "utf-8");
  
  manifest = manifest.replace(
    /https?:\/\/[^"]+?(?=\/\d+-\d+\/_expo)/g,
    currentBaseUrl
  );
  
  const hostWithoutProtocol = forwardedHost || "";
  manifest = manifest.replace(
    /"hostUri"\s*:\s*"[^"]+"/g,
    `"hostUri": "${hostWithoutProtocol}/${platform}"`
  );
  manifest = manifest.replace(
    /"debuggerHost"\s*:\s*"[^"]+"/g,
    `"debuggerHost": "${hostWithoutProtocol}/${platform}"`
  );

  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  logInfo("startup", "Serving static Expo files with dynamic manifest routing");

  app.get("/privacy-policy", (_req: Request, res: Response) => {
    const privacyPath = path.resolve(process.cwd(), "server", "templates", "privacy-policy.html");
    if (fs.existsSync(privacyPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(privacyPath);
    } else {
      res.status(404).send("Privacy Policy not found");
    }
  });

  app.get("/terms-of-service", (_req: Request, res: Response) => {
    const termsPath = path.resolve(process.cwd(), "server", "templates", "terms-of-service.html");
    if (fs.existsSync(termsPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(termsPath);
    } else {
      res.status(404).send("Terms of Service not found");
    }
  });

  app.get("/science", (_req: Request, res: Response) => {
    const sciencePath = path.resolve(process.cwd(), "server", "templates", "science.html");
    if (fs.existsSync(sciencePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(sciencePath);
    } else {
      res.status(404).send("Science page not found");
    }
  });

  app.get("/support", (_req: Request, res: Response) => {
    const supportPath = path.resolve(process.cwd(), "server", "templates", "support.html");
    if (fs.existsSync(supportPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(supportPath);
    } else {
      res.status(404).send("Support page not found");
    }
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, req, res);
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  const assetsPath = path.resolve(process.cwd(), "assets");
  const staticBuildPath = path.resolve(process.cwd(), "static-build");
  const landingAssetsPath = path.resolve(process.cwd(), "server", "templates", "landing-assets");
  
  app.use("/assets", express.static(assetsPath));
  app.use("/landing-assets", express.static(landingAssetsPath));
  app.use(express.static(staticBuildPath));

  logInfo("startup", "Static file serving configured", {
    assets: assetsPath,
    staticBuild: staticBuildPath,
  });
}

function setupHealthEndpoint(app: express.Application) {
  app.get("/api/health", async (_req: Request, res: Response) => {
    const health: Record<string, unknown> = {
      status: "ok",
      version: SERVER_VERSION,
      uptime_s: Math.floor(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      timestamp: timestamp(),
    };

    try {
      const start = Date.now();
      await pool.query("SELECT 1");
      health.database = { status: "connected", latency_ms: Date.now() - start };
    } catch (err) {
      const dbErr = err instanceof Error ? err.message : String(err);
      health.database = { status: "error", error: dbErr };
      health.status = "degraded";
    }

    const statusCode = health.status === "ok" ? 200 : 503;
    return res.status(statusCode).json(health);
  });
}

function setupApiCatchAll(app: express.Application) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      logWarn("http", "Unknown API endpoint hit", {
        method: req.method,
        path: req.path,
        ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
        user_agent: req.headers["user-agent"]?.substring(0, 120) || "unknown",
      });
      return res.status(404).json({ error: "API endpoint not found" });
    }
    next();
  });
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    logError("http", "Request error", {
      method: req.method,
      path: req.path,
      status,
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
    });

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

(async () => {
  const startTime = Date.now();

  setupProcessHandlers();

  logInfo("startup", `Retuned server v${SERVER_VERSION} starting`, {
    node_version: process.version,
    env: process.env.NODE_ENV || "development",
  });

  try {
    setupSecurityHeaders(app);
    logInfo("startup", "Security headers configured");
  } catch (err) {
    logError("startup", "Failed to configure security headers — continuing", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    setupCors(app);
    logInfo("startup", "CORS configured");
  } catch (err) {
    logError("startup", "Failed to configure CORS — continuing", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    setupBodyParsing(app);
    logInfo("startup", "Body parsing configured");
  } catch (err) {
    logError("startup", "Failed to configure body parsing — this is critical", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    setupRequestLogging(app);
    logInfo("startup", "Request logging configured");
  } catch (err) {
    logError("startup", "Failed to configure request logging — continuing", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    configureExpoAndLanding(app);
    logInfo("startup", "Expo and landing page configured");
  } catch (err) {
    logError("startup", "Failed to configure Expo/landing — continuing", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    setupHealthEndpoint(app);
    logInfo("startup", "Health endpoint registered at /api/health");
  } catch (err) {
    logError("startup", "Failed to setup health endpoint — continuing", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  let server;
  try {
    server = await registerRoutes(app);
    logInfo("startup", "API routes registered");
  } catch (err) {
    logError("startup", "Failed to register API routes — this is critical", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  }

  try {
    setupApiCatchAll(app);
    logInfo("startup", "API catch-all configured");
  } catch (err) {
    logError("startup", "Failed to setup API catch-all — continuing", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    setupErrorHandler(app);
    logInfo("startup", "Error handler configured");
  } catch (err) {
    logError("startup", "Failed to setup error handler — continuing", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    logInfo("startup", "Database connection verified", {
      latency_ms: Date.now() - dbStart,
    });
  } catch (err) {
    logWarn("startup", "Database connection check failed — server will start but DB may be unavailable", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      const bootTime = Date.now() - startTime;
      logInfo("startup", `Server ready on port ${port}`, {
        boot_time_ms: bootTime,
        version: SERVER_VERSION,
      });
    },
  );
})();
