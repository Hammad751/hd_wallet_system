import { Pool, QueryResult } from "pg";
import { config } from "./environment";

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,

  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

/**
 * Pool-level error handling
 * This usually means a broken idle client
 */
pool.on("error", (err: Error) => {
  console.error("🚨 Unexpected PostgreSQL error", err);
  process.exit(1);
});

/**
 * Typed query helper
 */
export const query = <T extends Record<string, any> = Record<string, any>>(
  text: string,
  params?: readonly unknown[]
): Promise<QueryResult<T>> => {
  return pool.query<T>(text, params ? [...params] : params);
};

/**
 * Graceful shutdown
 */
export const closePool = async (): Promise<void> => {
  await pool.end();
  console.log("🛑 PostgreSQL pool closed");
};

export default pool;









// import { Pool } from 'pg';
// import { config } from './environment';

// export const pool = new Pool({
//   host: config.database.host,
//   port: config.database.port,
//   database: config.database.name,
//   user: config.database.user,
//   password: config.database.password,
//   max: 20,
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 2000,
// });

// pool.on('error', (err) => {
//   console.error('Unexpected database error:', err);
// });

// export const query = (text: string, params?: any[]) => pool.query(text, params);
