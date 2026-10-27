import FinanceApp from "@/components/FinanceApp";
import { configured, serverClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configured()) redirect("/login");
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  return <FinanceApp demoMode={false} />;
}
