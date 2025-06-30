import { testConnection, migrateData } from "./db-migration";

async function setupDatabase() {
  console.log("🔧 Starting Supabase database setup...");
  
  try {
    // Test connection first
    console.log("📡 Testing database connection...");
    const connectionWorking = await testConnection();
    
    if (!connectionWorking) {
      console.error("❌ Database connection failed!");
      console.log("💡 Please check your DATABASE_URL format:");
      console.log("   - Should start with postgresql://");
      console.log("   - Get it from Supabase Dashboard → Settings → Database → Connection string → URI");
      process.exit(1);
    }
    
    console.log("✅ Database connection successful!");
    
    // Create tables using drizzle push
    console.log("🗄️ Creating database tables...");
    const { execSync } = require('child_process');
    execSync('npm run db:push', { stdio: 'inherit' });
    console.log("✅ Database tables created!");
    
    // Migrate sample data
    console.log("📦 Migrating sample data...");
    const migrationSuccess = await migrateData();
    
    if (migrationSuccess) {
      console.log("🎉 Database setup completed successfully!");
      console.log("📊 Sample data includes:");
      console.log("   - 2 equipment items (압축기, 보일러)");
      console.log("   - 4 work types");
      console.log("   - Sample work procedures");
      console.log("   - Equipment photos and safety information");
    } else {
      console.error("❌ Data migration failed!");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("💥 Database setup failed:", error);
    console.log("\n🔍 Troubleshooting:");
    console.log("1. Verify DATABASE_URL format (postgresql://...)");
    console.log("2. Check Supabase dashboard for correct connection string");
    console.log("3. Ensure database password is correct");
    process.exit(1);
  }
}

// Run setup if called directly
setupDatabase().catch(console.error);

export { setupDatabase };