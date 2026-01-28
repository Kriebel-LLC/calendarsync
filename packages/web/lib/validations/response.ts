import * as z from "zod";

export const errorResponse = z.object({
  error: z.string(),
});
