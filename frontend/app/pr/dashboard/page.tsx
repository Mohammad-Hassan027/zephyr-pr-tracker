import { cookies } from "next/headers";
import PRDashboardClient from "./PRDashboardClient";

export default function PRDashboardPage() {
  const code = cookies().get("pr_code")?.value || "";

  return <PRDashboardClient code={code} />;
}

