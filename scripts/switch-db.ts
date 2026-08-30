import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const mode = process.argv[2] || "pg";
const prismaDir = path.join(process.cwd(), "prisma");

if (mode === "pg" || mode === "postgres" || mode === "postgresql") {
  const source = path.join(prismaDir, "schema.postgresql.prisma");
  const dest = path.join(prismaDir, "schema.prisma");
  fs.copyFileSync(source, dest);
  console.log("✅ Switched Prisma schema to PostgreSQL (Supabase / Production)");
  execSync("npx prisma generate", { stdio: "inherit" });
} else if (mode === "sqlite") {
  const source = path.join(prismaDir, "schema.sqlite.prisma");
  const dest = path.join(prismaDir, "schema.prisma");
  fs.copyFileSync(source, dest);
  console.log("✅ Switched Prisma schema to SQLite (Local Dev / Fallback)");
  execSync("npx prisma generate", { stdio: "inherit" });
} else {
  console.error("Unknown database mode. Use 'pg' or 'sqlite'.");
  process.exit(1);
}
