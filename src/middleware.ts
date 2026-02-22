export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/designer/:path*", "/api/courses/:path*"],
};
