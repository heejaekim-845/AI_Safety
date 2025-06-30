# Supabase Database Setup Guide

## Step 1: Get the Correct Database URL

Your current DATABASE_URL is an HTTPS URL, but we need a PostgreSQL connection string.

### From Supabase Dashboard:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/projects)
2. Select your project
3. Go to **Settings** → **Database**
4. Scroll down to **Connection string**
5. Copy the **URI** (not the HTTPS URL)
6. It should look like: `postgresql://postgres.abc123:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres`

### Set the Environment Variable:

In your Replit project:
1. Go to the **Secrets** tab (lock icon in sidebar)
2. Edit the `DATABASE_URL` secret
3. Replace with the PostgreSQL URI from Supabase
4. Make sure to replace `[YOUR-PASSWORD]` with your actual database password

## Step 2: Test Connection

Once you provide the correct DATABASE_URL, run this command to test the connection:

```bash
node scripts/test-db-connection.js
```

## Step 3: Create Database Tables

After successful connection test, run:

```bash
npm run db:push
```

This will create all the required tables in your Supabase database.

## Step 4: Migrate Sample Data (Optional)

To populate the database with sample equipment and procedures:

```bash
npm run tsx server/db-migration.ts
```

## Database Schema

The system creates these tables:
- `equipment` - Equipment registry with safety information and photos
- `work_types` - Types of work procedures per equipment
- `work_procedures` - Step-by-step work instructions with safety notes
- `incidents` - Safety incident tracking
- `work_sessions` - Active work session management
- `risk_reports` - Risk assessment reports

## Current Status

✗ DATABASE_URL needs PostgreSQL connection string (starts with postgresql://)
✓ Database schema ready for deployment
✓ Sample data ready for migration
✓ Connection test script available
✓ App running with in-memory storage as fallback

## Sample Data Includes

- **압축기 A-101**: Air compressor with complete safety procedures
- **보일러 B-201**: Boiler with high-risk safety protocols
- Work procedures for equipment maintenance
- Emergency contact information
- Safety device locations and images