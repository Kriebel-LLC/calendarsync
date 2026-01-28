import { DBEnv } from "../types";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "shared/src/db/schema";

let internalDb: DrizzleD1Database<typeof schema> | undefined;

export const db = (env: DBEnv) => {
  if (!internalDb) {
    internalDb = drizzle(env.DB, { logger: true, schema });
  }

  return internalDb;
};

// Detects that the DatabaseError is due to a duplicated insert/update causing a unique constraint to fail
export function isDuplicateEntryError(error: Error): boolean {
  return /D1_ERROR: UNIQUE constraint failed:/i.test(error.message);
}
