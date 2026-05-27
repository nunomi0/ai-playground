import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const snakePublicDir = path.join(__dirname, "snake", "public");
const cardsPublicDir = path.join(__dirname, "cards", "public");
const giraffePublicDir = path.join(__dirname, "giraffe", "public");
const giraffeSrcDir = path.join(__dirname, "giraffe", "src");
const catArcadePublicDir = path.join(__dirname, "cat-arcade", "public");
const minecraftPublicDir = path.join(__dirname, "minecraft", "public");
const harvestBeatPublicDir = path.join(__dirname, "harvest-beat", "public");
const riftPublicDir = path.join(__dirname, "rift", "public");
const sandPublicDir = path.join(__dirname, "sand", "public");
const sandSrcDir = path.join(__dirname, "sand", "src");
const singularityPublicDir = path.join(__dirname, "singularity", "public");
const latticeOraclePublicDir = path.join(__dirname, "lattice-oracle", "public");
const pulseRushPublicDir = path.join(__dirname, "pulse-rush", "public");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

const DEFAULT_PRISM_TRIO_SUPABASE_URL = "https://rexaexziprkcyeyxnivh.supabase.co";
const DEFAULT_PRISM_TRIO_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJleGFleHppcHJrY3lleXhuaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MDgwNzgsImV4cCI6MjA5MzI4NDA3OH0.jjIAwIviP5vi04zd-rnD_Li0dFThERp9BOBJMSKoDLU";

function getCardsRuntimeConfigScript() {
  const config = {
    supabaseUrl: process.env.PRISM_TRIO_SUPABASE_URL ?? DEFAULT_PRISM_TRIO_SUPABASE_URL,
    supabaseAnonKey:
      process.env.PRISM_TRIO_SUPABASE_ANON_KEY ?? DEFAULT_PRISM_TRIO_SUPABASE_ANON_KEY,
  };

  return `window.__PRISM_TRIO_SUPABASE__ = Object.freeze(${JSON.stringify(config)});\n`;
}

function resolveFilePath(urlPath) {
  const [pathname] = urlPath.split("?");
  if (pathname === "/snake" || pathname === "/snake/") {
    return path.join(snakePublicDir, "index.html");
  }

  if (pathname.startsWith("/snake/")) {
    const safePath = path.normalize(pathname.slice("/snake".length)).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(snakePublicDir, safePath);
    return filePath.startsWith(snakePublicDir) ? filePath : null;
  }

  if (pathname === "/cards" || pathname === "/cards/") {
    return path.join(cardsPublicDir, "index.html");
  }

  if (pathname.startsWith("/cards/")) {
    const safePath = path.normalize(pathname.slice("/cards".length)).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(cardsPublicDir, safePath);
    return filePath.startsWith(cardsPublicDir) ? filePath : null;
  }

  if (pathname === "/giraffe" || pathname === "/giraffe/") {
    return path.join(giraffePublicDir, "index.html");
  }

  if (pathname.startsWith("/giraffe/src/")) {
    const safePath = path
      .normalize(pathname.slice("/giraffe/src".length))
      .replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(giraffeSrcDir, safePath);
    return filePath.startsWith(giraffeSrcDir) ? filePath : null;
  }

  if (pathname.startsWith("/giraffe/")) {
    const safePath = path
      .normalize(pathname.slice("/giraffe".length))
      .replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(giraffePublicDir, safePath);
    return filePath.startsWith(giraffePublicDir) ? filePath : null;
  }

  if (pathname === "/cat-arcade" || pathname === "/cat-arcade/") {
    return path.join(catArcadePublicDir, "index.html");
  }

  if (pathname.startsWith("/cat-arcade/")) {
    const safePath = path
      .normalize(pathname.slice("/cat-arcade".length))
      .replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(catArcadePublicDir, safePath);
    return filePath.startsWith(catArcadePublicDir) ? filePath : null;
  }

  if (pathname === "/minecraft" || pathname === "/minecraft/") {
    return path.join(minecraftPublicDir, "index.html");
  }

  if (pathname.startsWith("/minecraft/")) {
    const safePath = path.normalize(pathname.slice("/minecraft".length)).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(minecraftPublicDir, safePath);
    return filePath.startsWith(minecraftPublicDir) ? filePath : null;
  }

  if (pathname === "/harvest-beat" || pathname === "/harvest-beat/") {
    return path.join(harvestBeatPublicDir, "index.html");
  }

  if (pathname.startsWith("/harvest-beat/")) {
    const safePath = path
      .normalize(pathname.slice("/harvest-beat".length))
      .replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(harvestBeatPublicDir, safePath);
    return filePath.startsWith(harvestBeatPublicDir) ? filePath : null;
  }

  if (pathname === "/rift" || pathname === "/rift/") {
    return path.join(riftPublicDir, "index.html");
  }

  if (pathname.startsWith("/rift/")) {
    const safePath = path.normalize(pathname.slice("/rift".length)).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(riftPublicDir, safePath);
    return filePath.startsWith(riftPublicDir) ? filePath : null;
  }

  if (pathname === "/sand" || pathname === "/sand/") {
    return path.join(sandPublicDir, "index.html");
  }

  if (pathname.startsWith("/sand/src/")) {
    const safePath = path.normalize(pathname.slice("/sand/src".length)).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(sandSrcDir, safePath);
    return filePath.startsWith(sandSrcDir) ? filePath : null;
  }

  if (pathname.startsWith("/sand/")) {
    const safePath = path.normalize(pathname.slice("/sand".length)).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(sandPublicDir, safePath);
    return filePath.startsWith(sandPublicDir) ? filePath : null;
  }

  if (pathname === "/singularity" || pathname === "/singularity/") {
    return path.join(singularityPublicDir, "index.html");
  }

  if (pathname.startsWith("/singularity/")) {
    const safePath = path
      .normalize(pathname.slice("/singularity".length))
      .replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(singularityPublicDir, safePath);
    return filePath.startsWith(singularityPublicDir) ? filePath : null;
  }

  if (pathname === "/lattice-oracle" || pathname === "/lattice-oracle/") {
    return path.join(latticeOraclePublicDir, "index.html");
  }

  if (pathname.startsWith("/lattice-oracle/")) {
    const safePath = path
      .normalize(pathname.slice("/lattice-oracle".length))
      .replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(latticeOraclePublicDir, safePath);
    return filePath.startsWith(latticeOraclePublicDir) ? filePath : null;
  }

  if (pathname === "/pulse-rush" || pathname === "/pulse-rush/") {
    return path.join(pulseRushPublicDir, "index.html");
  }

  if (pathname.startsWith("/pulse-rush/")) {
    const safePath = path
      .normalize(pathname.slice("/pulse-rush".length))
      .replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(pulseRushPublicDir, safePath);
    return filePath.startsWith(pulseRushPublicDir) ? filePath : null;
  }

  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);
  return filePath.startsWith(publicDir) ? filePath : null;
}

const server = http.createServer(async (request, response) => {
  const [pathname] = (request.url ?? "/").split("?");

  if (pathname === "/cards/runtime-config.js") {
    response.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(getCardsRuntimeConfigScript());
    return;
  }

  const filePath = resolveFilePath(request.url ?? "/");

  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
});

export { server };

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
server.listen(port, host, () => {
  console.log(`Playground running at http://${host}:${port}`);
});
