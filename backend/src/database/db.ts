import { Pool } from 'pg';
import 'dotenv/config';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // String de conexão do Neon
  ssl: { rejectUnauthorized: false },
});