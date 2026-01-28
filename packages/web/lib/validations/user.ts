import { Role } from "shared/src/types/role";
import * as z from "zod";

export const userNameSchema = z.object({
  name: z.string().min(3).max(32),
});

export const userOrgInviteCreateSchema = z.object({
  invitee_email: z.string().email(),
  role: z.nativeEnum(Role),
});
