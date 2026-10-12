import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// アプリは役目を終えたため、すべてのアクセスを終了案内ページに向ける
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "This app has been closed." }, { status: 410 });
  }

  if (pathname === "/closed") {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL("/closed", request.url));
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|manifest.json|sw.js|workbox-|icon-|hero.jpg|images/).*)"],
};
