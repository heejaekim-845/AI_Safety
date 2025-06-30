import { db } from "./db";

async function testConnection() {
  try {
    console.log("Testing Supabase database connection...");
    const result = await db.execute(`SELECT version()`);
    console.log("Database connection successful!");
    console.log("PostgreSQL version:", result.rows[0]);
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

testConnection();