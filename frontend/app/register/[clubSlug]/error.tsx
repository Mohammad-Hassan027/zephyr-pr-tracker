"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "@/lib/icons";

export default function ClubRegisterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Registration page error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4 sm:p-6">
      <div className="surface-card w-full p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
          <AlertTriangle size={24} aria-hidden="true" />
        </div>
        <h1 className="page-title text-xl">Could not load registration</h1>
        <p className="page-subtitle text-zinc-500 text-xs">
          {error?.message || "An unexpected error occurred while loading this club registration form."}
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-primary text-xs px-4 py-2"
          >
            Try Again
          </button>
          <Link href="/clubs" className="btn-secondary text-xs px-4 py-2">
            Browse All Clubs
          </Link>
        </div>
      </div>
    </main>
  );
}
