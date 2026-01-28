import { redirect } from "next/navigation";

import { DashboardHeader } from "@/custom-components/header";
import { DashboardShell } from "@/custom-components/shell";
import { UserNameForm } from "@/custom-components/user-name-form";
import { getCurrentServerUser } from "@/lib/session";
import { cookies } from "next/headers";

export const metadata = {
  title: "Settings",
  description: "Manage account and website settings.",
};

export default async function SettingsPage() {
  const user = await getCurrentServerUser(cookies());

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Settings"
        text="Manage account and website settings."
      />
      <div className="grid gap-10">
        <UserNameForm user={{ uid: user.uid, displayName: user.name || "" }} />
      </div>
    </DashboardShell>
  );
}
