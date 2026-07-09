import "dotenv/config";
import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check your .env file.");
}

const normalizeDatabaseUrl = (connectionString: string): string => {
  try {
    const connectionUrl = new URL(connectionString);
    const sslMode = connectionUrl.searchParams.get("sslmode")?.toLowerCase();
    const useLibpqCompat =
      connectionUrl.searchParams.get("uselibpqcompat") === "true";

    if (
      !useLibpqCompat &&
      sslMode &&
      ["prefer", "require", "verify-ca"].includes(sslMode)
    ) {
      // Preserve pg v8 behavior explicitly to avoid sslmode alias warnings.
      connectionUrl.searchParams.set("sslmode", "verify-full");
    }

    return connectionUrl.toString();
  } catch {
    return connectionString;
  }
};

const pool = new Pool({
  connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
});

const adapter = new PrismaPg(pool as any);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db: PrismaClient = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
