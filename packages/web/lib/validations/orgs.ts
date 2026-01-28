import * as z from "zod";

// Make sure both of these are in sync (there doesn't seem to be a way to negate a regex string)
export const orgNameRegex = /^[a-z0-9-]+$/;
export const orgNameNotCharacterRegex = /[^a-z0-9-]/g;

const orgName = z.string().min(1).max(100).regex(orgNameRegex);

export const orgNameRouteContextSchema = z.object({
  params: z.object({
    name: z.string(),
  }),
});
export type orgNameRouteContextSchemaType = z.infer<
  typeof orgNameRouteContextSchema
>;

export const orgCreateSchema = z.object({
  name: orgName,
});

export const orgNameUpdateSchema = z.object({
  name: orgName,
});
