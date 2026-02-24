export { auth as default } from "@/lib/auth";

export const config = {
  matcher: ["/dashboard/:path*", "/designer/:path*", "/api/courses/:path*"],
};
