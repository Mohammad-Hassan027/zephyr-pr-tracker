/**
 * Root page — redirects visitors to the public clubs directory.
 *
 * Next.js App Router: `redirect()` from "next/navigation" produces a
 * permanent-style 307/308 server-side redirect during rendering, so
 * `GET /` is never a 404 and requires no authenticated session.
 */
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/clubs");
}
