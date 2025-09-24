import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const protectedPaths = ["/admin", "/api/admin"];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (!protectedPaths.some((protectedPath) => path.startsWith(protectedPath))) {
    return NextResponse.next();
  }

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return new NextResponse("Admin credentials not configured.", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": "Basic realm=\"Admin Dashboard\"",
      },
    });
  }

  const credentials = Buffer.from(authHeader.replace("Basic ", ""), "base64").toString();
  const [username, password] = credentials.split(":");

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return NextResponse.next();
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": "Basic realm=\"Admin Dashboard\"",
    },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
