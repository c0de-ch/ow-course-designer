import { withAuth } from "next-auth/middleware";

export default withAuth;

export const config = {
  matcher: ["/dashboard/:path*", "/designer/:path*", "/api/courses/:path*"],
};
