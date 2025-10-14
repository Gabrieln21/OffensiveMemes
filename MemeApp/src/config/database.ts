// src/config/database.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Prefer a single DATABASE_URL; otherwise fall back to PG* / DB_* vars.
// IMPORTANT: default host is 'postgres' (the Docker service), not 'localhost'.
const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : new Pool({
        user:     process.env.PGUSER      || process.env.DB_USER      || 'appuser',
        host:     process.env.PGHOST      || process.env.DB_HOST      || 'postgres',
        database: process.env.PGDATABASE  || process.env.DB_NAME      || 'appdb',
        password: process.env.PGPASSWORD  || process.env.DB_PASSWORD  || 'change_me_pg',
        port:    +(process.env.PGPORT     || process.env.DB_PORT      || '5432'),
    });

export { pool };
