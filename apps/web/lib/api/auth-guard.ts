import { auth } from "@/lib/auth";
import type { Role } from "@kyarainnovate/db/schema";
import { FORBIDDEN, UNAUTHORIZED } from "./response";

type AuthResult =
  | { authorized: true; userId: string; role: Role }
  | { authorized: false; response: ReturnType<typeof UNAUTHORIZED> };

export async function requireAuth(allowedRoles?: Role[]): Promise<AuthResult> {
  const session = await auth();

  if (!session) {
    return { authorized: false, response: UNAUTHORIZED() };
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return { authorized: false, response: FORBIDDEN() };
  }

  return {
    authorized: true,
    userId: session.user.id,
    role: session.user.role,
  };
}
