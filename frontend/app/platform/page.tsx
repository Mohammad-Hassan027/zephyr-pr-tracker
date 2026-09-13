/**
 * Platform admin compatibility redirect.
 *
 * The canonical platform governance page lives at /platform/clubs.
 * This redirect ensures old links to /platform (e.g. from README v1 or
 * bookmarks) land on the correct page instead of returning a 404.
 *
 * Middleware in proxy.ts only hard-gates /platform/clubs/:path+ (sub-paths),
 * so this redirect page is reachable without a session cookie and will
 * pass the visitor on to /platform/clubs, which handles its own inline login.
 */
import { redirect } from "next/navigation";

export default function PlatformPage() {
  redirect("/platform/clubs");
}
