"use client";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";
import React from "react";

import CreateOrgModal from "@/custom-components/create-org-modal";
import FeedbackModal from "@/custom-components/feedback-modal";
import { UserAvatar } from "@/custom-components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "components/ui/dropdown-menu";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";

interface UserAccountNavProps extends React.HTMLAttributes<HTMLDivElement> {
  user: { name?: string; email?: string; picture?: string };
}

export function UserAccountNav({ user }: UserAccountNavProps) {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();

  const [feedbackModalOpen, setFeedbackModalOpen] = React.useState(false);
  const [createOrgModalOpen, setCreateOrgModalOpen] = React.useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <UserAvatar
          user={{
            name: user.name || "",
            image: user.picture || "",
          }}
          className="h-8 w-8"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            {user.name && <p className="font-medium">{user.name}</p>}
            {user.email && (
              <p className="w-[200px] truncate text-sm text-muted-foreground">
                {user.email}
              </p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href={`/${segment}`}>Dashboard</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href={`/${segment}/billing`}>Billing</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href={`/${segment}/settings`}>Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => setCreateOrgModalOpen(true)}
        >
          Create new organization
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setFeedbackModalOpen(true)}
          className="cursor-pointer"
        >
          Send Feedback
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={(event) => {
            event.preventDefault();
            Promise.all([
              signOut(auth),
              fetch("/api/logout", {
                method: "GET",
              }),
            ])
              .then(() => {
                router.push(`${window.location.origin}/login`);
              })
              .catch((error) => {
                console.error(error);
              });
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
      />
      <CreateOrgModal
        open={createOrgModalOpen}
        onOpenChange={setCreateOrgModalOpen}
      />
    </DropdownMenu>
  );
}
