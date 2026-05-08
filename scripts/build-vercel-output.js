import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

const outputDir = path.join(rootDir, ".vercel", "output");
const staticDir = path.join(outputDir, "static");
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

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(staticDir, { recursive: true });

  await cp(path.join(rootDir, "public"), staticDir, { recursive: true });
  await cp(path.join(rootDir, "snake", "public"), path.join(staticDir, "snake"), {
    recursive: true,
  });
  await cp(path.join(rootDir, "cards", "public"), path.join(staticDir, "cards"), {
    recursive: true,
  });
  await writeFile(
    path.join(staticDir, "cards", "runtime-config.js"),
    getCardsRuntimeConfigScript(),
    "utf8",
  );
  await cp(path.join(rootDir, "giraffe", "public"), path.join(staticDir, "giraffe"), {
    recursive: true,
  });
  await cp(path.join(rootDir, "giraffe", "src"), path.join(staticDir, "giraffe", "src"), {
    recursive: true,
  });
  await cp(path.join(rootDir, "minecraft", "public"), path.join(staticDir, "minecraft"), {
    recursive: true,
  });
  await cp(path.join(rootDir, "rift", "public"), path.join(staticDir, "rift"), {
    recursive: true,
  });
  await cp(path.join(rootDir, "sand", "public"), path.join(staticDir, "sand"), {
    recursive: true,
  });
  await cp(path.join(rootDir, "sand", "src"), path.join(staticDir, "sand", "src"), {
    recursive: true,
  });

  const config = {
    version: 3,
    routes: [
      { src: "/snake", dest: "/snake/index.html" },
      { src: "/cards", dest: "/cards/index.html" },
      { src: "/giraffe", dest: "/giraffe/index.html" },
      { src: "/minecraft", dest: "/minecraft/index.html" },
      { src: "/rift", dest: "/rift/index.html" },
      { src: "/sand", dest: "/sand/index.html" },
      { handle: "filesystem" },
    ],
  };

  await writeFile(
    path.join(outputDir, "config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
