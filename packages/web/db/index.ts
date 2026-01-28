import { getCloudflareContext } from "@opennextjs/cloudflare";
import { db as instantiateDb } from "shared/src/db";

// to ONLY be used in backend requests since that's where getRequestContext is available
// TODO: refactor this to not be called during builds (wrap it in a function!!!!)
export const db = () => {
  const { env } = getCloudflareContext();
  return instantiateDb(env);
};
