import Link from "next/link";
import Header from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <div className="surface-card w-full max-w-md p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-2xl font-bold text-accent">
            404
          </div>
          <h1 className="page-title text-xl sm:text-2xl">Page Not Found</h1>
          <p className="page-subtitle text-slate-600 text-sm">
            The page you are looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <Link href="/clubs" className="btn-primary">
              Browse Clubs
            </Link>
            <Link href="/my-status" className="btn-secondary">
              Check Status
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
