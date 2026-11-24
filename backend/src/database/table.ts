import { Pool } from 'pg';
import 'dotenv/config';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS streams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug VARCHAR(32) UNIQUE NOT NULL,
      title VARCHAR(120) DEFAULT 'Transmissão ao Vivo',
      is_live BOOLEAN DEFAULT true,
      viewers_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      ended_at TIMESTAMP WITH TIME ZONE
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_streams_slug ON streams(slug);
  `);
}

