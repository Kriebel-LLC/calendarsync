import { redirect } from "next/navigation";

import { DashboardHeader } from "@/custom-components/header";
import { DashboardShell } from "@/custom-components/shell";
import { getCurrentServerUser } from "@/lib/session";
import { Button } from "components/ui/button";
import { cookies } from "next/headers";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await getCurrentServerUser(await cookies());

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell>
      <DashboardHeader heading="Dashboard" text="Your personal dashboard.">
        <Button disabled>TODO</Button>
      </DashboardHeader>
      <div>Add dashboard stuff here!</div>
    </DashboardShell>
  );
}
