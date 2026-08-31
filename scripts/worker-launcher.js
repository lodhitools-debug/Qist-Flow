/**
 * PM2 Windows Worker Launcher
 * Spawns tsx to run the TypeScript worker file.
 * This is needed because PM2 on Windows cannot directly use .cmd shims as interpreters.
 */
const { spawn } = require("child_process");
const path = require("path");
const tsxCmd = path.join(__dirname, "..", "node_modules", ".bin", "tsx");
const workerFile = path.join(__dirname, "start-worker.ts");

const child = spawn(
  process.platform === "win32" ? tsxCmd + ".cmd" : tsxCmd,
  [workerFile],
  {
    stdio: "inherit",
    env: { ...process.env, IS_WORKER: "true" },
    shell: true,
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
