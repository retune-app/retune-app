import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
      // Also add with port for mobile app requests
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}:5000`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
        origins.add(`https://${d.trim()}:5000`);
      });
    }

    const origin = req.header("origin");

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    // Mobile apps (React Native) may not send an origin header
    // Allow requests without origin for API endpoints
    const isMobileApp = !origin && req.path.startsWith("/api/");

    if (isMobileApp || (origin && (origins.has(origin) || isLocalhost))) {
      // For mobile apps without origin, use a wildcard-compatible approach
      if (origin) {
        res.header("Access-Control-Allow-Origin", origin);
      } else {
        // For requests without origin (mobile apps), allow the request
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
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
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

  // Get the current host to dynamically rewrite URLs
  const forwardedProto = req.header("x-forwarded-proto") || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host") || req.get("host");
  const currentBaseUrl = `${forwardedProto}://${forwardedHost}`;

  let manifest = fs.readFileSync(manifestPath, "utf-8");
  
  // Dynamically replace any old base URLs with the current host
  // This handles the case where the manifest was built on a different domain
  manifest = manifest.replace(
    /https?:\/\/[^"]+?(?=\/\d+-\d+\/_expo)/g,
    currentBaseUrl
  );
  
  // Also update hostUri and debuggerHost
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

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

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

  log("Serving static Expo files with dynamic manifest routing");

  // Serve Privacy Policy page
  app.get("/privacy-policy", (_req: Request, res: Response) => {
    const privacyPath = path.resolve(process.cwd(), "server", "templates", "privacy-policy.html");
    if (fs.existsSync(privacyPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(privacyPath);
    } else {
      res.status(404).send("Privacy Policy not found");
    }
  });

  // Serve Terms of Service page
  app.get("/terms-of-service", (_req: Request, res: Response) => {
    const termsPath = path.resolve(process.cwd(), "server", "templates", "terms-of-service.html");
    if (fs.existsSync(termsPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(termsPath);
    } else {
      res.status(404).send("Terms of Service not found");
    }
  });

  // Serve Support page
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
  
  log(`Static paths: assets=${assetsPath}`);
  
  app.use("/assets", express.static(assetsPath));
  // Note: /uploads is handled by API routes in routes.ts with security validations
  app.use(express.static(staticBuildPath));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );
})();
