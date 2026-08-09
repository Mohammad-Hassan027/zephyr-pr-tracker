"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
          <div className="surface-card w-full p-8 text-center">
            <p className="pill-chip">Loading</p>
            <h1 className="mt-3 text-xl font-semibold text-ink">
              Redirecting...
            </h1>
          </div>
        </main>
      }
    >
      <RegisterRedirect />
    </Suspense>
  );
}

function RegisterRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clubSlug = searchParams.get("club") || searchParams.get("c");
  const refCode = searchParams.get("ref");

  useEffect(() => {
    if (clubSlug) {
      const target = refCode
        ? `/register/${encodeURIComponent(clubSlug)}?ref=${encodeURIComponent(refCode)}`
        : `/register/${encodeURIComponent(clubSlug)}`;
      router.replace(target);
    }
  }, [clubSlug, refCode, router]);

  if (clubSlug) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
        <div className="surface-card w-full p-8 text-center">
          <p className="pill-chip">Redirecting</p>
          <h1 className="mt-3 text-xl font-semibold text-ink">
            Opening {clubSlug} registration...
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
      <div className="surface-card w-full p-8 text-center">
        <p className="pill-chip">Zephyr</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink">
          Select a Club
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Registrations are managed individually by each club. Please use a club's registration URL (e.g. <code className="font-mono text-xs">/register/club-slug</code>).
        </p>
      </div>
    </main>
  );
}
