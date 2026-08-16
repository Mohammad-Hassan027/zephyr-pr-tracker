import { cookies } from "next/headers";
import PRQueue from "@/components/PRQueue";
import PRHeader from "@/components/PRHeader";

export default function PRDashboardPage() {
  const code = cookies().get("pr_code")?.value || "";

  return (
    <>
      <PRHeader code={code} />
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
