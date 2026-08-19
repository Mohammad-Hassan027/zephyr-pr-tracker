export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center p-4 sm:p-6">
      <div className="surface-card w-full p-8 text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <p className="text-sm font-medium text-zinc-500">Loading...</p>
      </div>
    </main>
  );
}
