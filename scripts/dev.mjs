import { spawn } from "node:child_process";
const args = process.argv.slice(2);
const value = (key, fallback) => {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : fallback;
};
const port = value("--port", process.env.PORT ?? "3000");
const host = value("--host", "0.0.0.0");
if (!/^\d+$/.test(port)) throw Error("Invalid port");
const children = [
  spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      args.includes("--production") ? "start" : "dev",
      "--hostname",
      host,
      "--port",
      port,
    ],
    { stdio: "inherit" },
  ),
  spawn(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      ...(args.includes("--production") ? [] : ["watch"]),
      "src/worker/index.ts",
    ],
    { stdio: "inherit" },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500).unref();
}
for (const child of children) child.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
