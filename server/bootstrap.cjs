const http = require("node:http");
const PORT = parseInt(process.env.PORT || "5000", 10);

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-cache" });
  res.end("ok");
});

globalThis.__bootstrapServer = server;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[bootstrap] Port ${PORT} open`);
  import("../server_dist/index.js").catch(err => {
    console.error("[bootstrap] Failed to load server:", err.message);
    process.exit(1);
  });
});
