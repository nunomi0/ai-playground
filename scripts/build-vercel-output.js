import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

const outputDir = path.join(rootDir, ".vercel", "output");
const staticDir = path.join(outputDir, "static");

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
  await cp(path.join(rootDir, "minecraft", "public"), path.join(staticDir, "minecraft"), {
    recursive: true,
  });

  const config = {
    version: 3,
    routes: [
      { src: "/snake", dest: "/snake/index.html" },
      { src: "/cards", dest: "/cards/index.html" },
      { src: "/minecraft", dest: "/minecraft/index.html" },
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
