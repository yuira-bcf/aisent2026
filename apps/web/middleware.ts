import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const publicPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];
const publicViewPaths = ["/creators"];
const creatorPaths = [
  "/keywords",
  "/stats",
  "/creator/dashboard",
  "/creator/settings",
  "/creator/recipes",
  "/creator/royalties",
  "/creator/data-input",
  "/creator/footprints",
];
const adminPaths = ["/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public-view paths (accessible to both authed and unauthed users)
  if (publicViewPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    // Redirect authenticated users away from auth pages
    if (req.auth) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Require authentication for all other routes
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = req.auth.user?.role;

  // Creator routes require CREATOR or ADMIN
  if (creatorPaths.some((p) => pathname.startsWith(p))) {
    if (role !== "CREATOR" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/blend", req.url));
    }
  }

  // Admin routes require ADMIN
  if (adminPaths.some((p) => pathname.startsWith(p))) {
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
