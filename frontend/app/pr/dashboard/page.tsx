import { cookies } from "next/headers";
import PRQueue from "@/components/PRQueue";

export default function PRDashboardPage() {
  const code = cookies().get("pr_code")?.value || "";

  return (
    <>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-orange-600">ZEPHYR</span>
            <span className="text-xs text-gray-400">PR Approvals</span>
          </div>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
            Logged in as {code}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Pending Approvals</h1>
        <p className="mt-1 text-sm text-gray-500">
          Registrations that used your referral code, waiting on you to verify payment.
        </p>
        <PRQueue code={code} />
      </main>
    </>
  );
}
