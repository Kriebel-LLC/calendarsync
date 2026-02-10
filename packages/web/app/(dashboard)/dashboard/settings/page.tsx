import { redirect } from "next/navigation";

import { DashboardHeader } from "@/custom-components/header";
import { NotionSettings } from "@/custom-components/notion-settings";
import { DashboardShell } from "@/custom-components/shell";
import { UserNameForm } from "@/custom-components/user-name-form";
import { getNotionConnectionInfo } from "@/lib/notion/notion-connection";
import { getCurrentServerUser } from "@/lib/session";
import { cookies } from "next/headers";

export const metadata = {
  title: "Settings",
  description: "Manage account and website settings.",
};

export default async function SettingsPage() {
  const user = await getCurrentServerUser(await cookies());

  if (!user) {
    redirect("/login");
  }

  const notionConnection = await getNotionConnectionInfo(user.uid);

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Settings"
        text="Manage account and website settings."
      />
      <div className="grid gap-10">
        <UserNameForm user={{ uid: user.uid, displayName: user.name || "" }} />
        <NotionSettings initialConnection={notionConnection} />
      </div>
    </DashboardShell>
  );
}
