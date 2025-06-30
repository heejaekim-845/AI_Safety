import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Convert postgres:// to postgresql:// for Neon compatibility
let dbUrl = process.env.DATABASE_URL;
if (dbUrl.startsWith('postgres://')) {
  dbUrl = dbUrl.replace('postgres://', 'postgresql://');
}

const sql = neon(dbUrl);
export const db = drizzle(sql);