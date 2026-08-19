"use client";

import { useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <>
      <Header />
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <div className="surface-card w-full max-w-md p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-rose-100 text-2xl font-bold text-rose-600">
            ⚠️
          </div>
          <h1 className="page-title text-xl sm:text-2xl">Something went wrong</h1>
          <p className="page-subtitle text-zinc-500 text-sm">
            {error?.message || "An unexpected error occurred while loading this page."}
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="btn-primary"
            >
              Try Again
            </button>
            <Link href="/clubs" className="btn-secondary">
              Go to Home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
