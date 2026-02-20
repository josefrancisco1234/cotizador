import { NextRequest, NextResponse } from "next/server";

// Auth is handled client-side via sessionStorage.
// Middleware only redirects bare "/" to the main page.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/ingestions", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
