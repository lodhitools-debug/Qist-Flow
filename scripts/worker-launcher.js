/**
 * PM2 Worker Launcher (cross-platform with fallbacks)
 * Finds tsx via: local node_modules -> global paths -> npx
 */
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const workerFile = path.join(__dirname, "start-worker.ts");

// Find tsx: try multiple locations
function findTsx() {
  const isWin = process.platform === "win32";

  // 1. Local node_modules (fastest)
  const localTsx = path.join(__dirname, "..", "node_modules", ".bin", "tsx");
  const localTsxCmd = isWin ? localTsx + ".cmd" : localTsx;
  if (fs.existsSync(localTsxCmd)) {
    console.log("[launcher] Using local tsx:", localTsxCmd);
    return { cmd: localTsxCmd, args: [workerFile], shell: true };
  }

  // 2. AlwaysData global npm-packages path
  const alwaysdataGlobal = "/home/qistflow27/.npm-packages/bin/tsx";
  if (fs.existsSync(alwaysdataGlobal)) {
    console.log("[launcher] Using AlwaysData global tsx:", alwaysdataGlobal);
    return { cmd: alwaysdataGlobal, args: [workerFile], shell: false };
  }

  // 3. which tsx (any global)
  try {
    const globalTsx = execSync("which tsx 2>/dev/null", { encoding: "utf8" }).trim().split("\n")[0].trim();
    if (globalTsx && fs.existsSync(globalTsx)) {
      console.log("[launcher] Using global tsx:", globalTsx);
      return { cmd: globalTsx, args: [workerFile], shell: false };
    }
  } catch {}

  // 4. npx tsx fallback
  console.log("[launcher] tsx not found, falling back to: npx tsx");
  const npxCmd = isWin ? "npx.cmd" : "npx";
  return { cmd: npxCmd, args: ["tsx", workerFile], shell: false };
}

const { cmd, args, shell } = findTsx();
console.log("[launcher] Starting worker:", cmd, args.join(" "));

const child = spawn(cmd, args, {
  stdio: "inherit",
  env: { ...process.env, IS_WORKER: "true", PATH: `/home/qistflow27/.npm-packages/bin:${process.env.PATH || ""}` },
  shell,
});

child.on("error", (err) => {
  console.error("[launcher] Failed to start worker:", err.message);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
