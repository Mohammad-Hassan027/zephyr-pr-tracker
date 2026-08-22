import { cookies } from "next/headers";
import PRDashboardClient from "./PRDashboardClient";

export default async function PRDashboardPage() {
  const code = (await cookies()).get("pr_code")?.value || "";

  return <PRDashboardClient code={code} />;
}

