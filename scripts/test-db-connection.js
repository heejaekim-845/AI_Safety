import pkg from 'pg';
const { Pool } = pkg;

async function testConnection() {
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not found');
    return false;
  }

  if (!process.env.DATABASE_URL.startsWith('postgresql://')) {
    console.log('❌ DATABASE_URL must start with postgresql://');
    console.log('Current format:', process.env.DATABASE_URL.substring(0, 20) + '...');
    console.log('Expected format: postgresql://postgres.abc123:[PASSWORD]@...');
    return false;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Testing connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    await pool.end();
    
    console.log('✅ Database connection successful!');
    console.log('📅 Server time:', result.rows[0].now);
    return true;
  } catch (error) {
    await pool.end();
    console.log('❌ Connection failed:', error.message);
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});