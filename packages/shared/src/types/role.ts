import { assertNever } from "shared/src/utils";

export enum Role {
  ADMIN = "admin",
  WRITE = "write",
  READ = "read",
}

const RoleRanking = [Role.READ, Role.WRITE, Role.ADMIN];

export function roleEqualToOrAbove(roleToCheck: Role) {
  const roleIndex = RoleRanking.indexOf(roleToCheck);

  if (roleIndex === -1) {
    throw new Error(`Invalid role: ${roleToCheck}`);
  }

  return RoleRanking.slice(roleIndex);
}

export function hasPermission(roleToCheck: Role, minimumRanking: Role) {
  const roleIndex = RoleRanking.indexOf(roleToCheck);
  const minimumRankingIndex = RoleRanking.indexOf(minimumRanking);

  return roleIndex >= minimumRankingIndex;
}

export function roleToUserDescription(role: Role): string {
  switch (role) {
    case Role.ADMIN:
      return "Admin";
    case Role.WRITE:
      return "Editor";
    case Role.READ:
      return "Viewer";
    default:
      return assertNever(role);
  }
}
