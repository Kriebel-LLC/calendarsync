"use client";

import { clientFetch } from "@/lib/fetch";
import { daysUntilDate } from "@/lib/utils";
import { userOrgInviteCreateSchema } from "@/lib/validations/user";
import { OrgUserWithDetail } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Avatar, AvatarFallback, AvatarImage } from "components/ui/avatar";
import { Button } from "components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "components/ui/dialog";
import { Input } from "components/ui/input";
import { Label } from "components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "components/ui/tabs";
import { toast } from "components/ui/use-toast";
import { useRouter } from "next/navigation";
import React from "react";
import { UseFormRegisterReturn, useForm } from "react-hook-form";
import { OrgInvite } from "shared/src/db/schema";
import { Role, roleToUserDescription } from "shared/src/types/role";
import * as z from "zod";

// TODO: this uses router.refresh on an expensive server route (does many queries), consider refactoring to not use refresh

function RoleSelectContent({
  ref,
}: {
  ref?: React.ForwardedRef<HTMLButtonElement>;
}) {
  return (
    <>
      <SelectTrigger className="w-[180px]" ref={ref}>
        <SelectValue placeholder="Select a role" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {Object.values(Role).map((role) => (
            <SelectItem value={role} key={role}>
              {roleToUserDescription(role)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </>
  );
}

function RoleSelect({
  onChange,
  defaultValue,
  disabled,
}: {
  onChange: (role: Role) => void;
  defaultValue: Role;
  disabled?: boolean;
}) {
  return (
    <Select
      onValueChange={(value) => onChange(value as Role)}
      defaultValue={defaultValue}
      disabled={disabled}
    >
      <RoleSelectContent />
    </Select>
  );
}

const RoleSelectForm = React.forwardRef<
  HTMLButtonElement,
  UseFormRegisterReturn
>(({ name, onChange, required, disabled }, ref) => {
  return (
    <Select
      name={name}
      onValueChange={(value) => onChange({ target: { name, value } })}
      required={required}
      disabled={disabled}
      defaultValue={Role.ADMIN}
    >
      <RoleSelectContent ref={ref} />
    </Select>
  );
});
RoleSelectForm.displayName = "RoleSelectForm";

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
}

function InviteModal({ open, onOpenChange, orgName }: InviteModalProps) {
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<z.infer<typeof userOrgInviteCreateSchema>>({
    resolver: zodResolver(userOrgInviteCreateSchema),
    defaultValues: {
      invitee_email: "",
      role: Role.ADMIN,
    },
  });
  const router = useRouter();

  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  async function onSubmit(data: z.infer<typeof userOrgInviteCreateSchema>) {
    clientFetch(
      `/api/orgs/${orgName}/invites`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      {
        beforeRequestStart: () => setIsSaving(true),
        afterRequestFinish: () => setIsSaving(false),
        onRequestSuccess: () => {
          onOpenChange(false);

          toast({
            title: "Success",
            description: `Invite sent to ${data.invitee_email}`,
          });

          router.refresh();
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Invite member to {orgName}</DialogTitle>
          </DialogHeader>
          <div className="my-4">
            <div className="mb-2">
              <Label htmlFor="invitee-email">Email</Label>
              <Input
                id="invitee-email"
                type="text"
                {...register("invitee_email")}
              />
              {errors?.invitee_email && (
                <p className="px-1 text-xs text-red-600">
                  {errors.invitee_email.message}
                </p>
              )}
            </div>
            <Label htmlFor="member-role">Role</Label>
            <RoleSelectForm {...register("role")} />
            {errors?.role && (
              <p className="px-1 text-xs text-red-600">{errors.role.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={!!errors?.invitee_email}
              loading={isSaving}
            >
              Send invitation
            </Button>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteTable({
  invites,
  currentUserRole,
  orgName,
}: {
  invites: OrgInvite[];
  currentUserRole: Role;
  orgName: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {invites.length === 0 && (
          <TableRow>
            <TableCell colSpan={4}>No invites found</TableCell>
          </TableRow>
        )}
        {invites.map((invite) => (
          <TableRow key={invite.id}>
            <TableCell className="flex items-center font-medium">
              <Avatar className="mr-2">
                <AvatarFallback>
                  {invite.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {invite.email}
            </TableCell>
            <TableCell>
              <RoleSelect
                defaultValue={invite.role}
                onChange={async (role) => {
                  clientFetch(
                    `/api/orgs/${orgName}/invites`,
                    {
                      method: "PATCH",
                      body: JSON.stringify({
                        invite_id: invite.id,
                        role,
                      }),
                    },
                    {
                      beforeRequestStart: () => setIsLoading(true),
                      afterRequestFinish: () => setIsLoading(false),
                      onRequestSuccess: () => {
                        toast({
                          title: "Success",
                          description: `${
                            invite.email
                          }'s role was changed to ${roleToUserDescription(
                            role
                          )}`,
                        });

                        router.refresh();
                      },
                    }
                  );
                }}
                disabled={currentUserRole !== Role.ADMIN || isLoading}
              />
            </TableCell>
            <TableCell>
              Expires in {daysUntilDate(invite.expires)} day(s)
            </TableCell>
            <TableCell>
              <Button
                variant="outline"
                disabled={currentUserRole !== Role.ADMIN}
                loading={isLoading}
                onClick={async () => {
                  clientFetch(
                    `/api/orgs/${orgName}/invites`,
                    {
                      method: "DELETE",
                      body: JSON.stringify({
                        invite_id: invite.id,
                      }),
                    },
                    {
                      beforeRequestStart: () => setIsLoading(true),
                      afterRequestFinish: () => setIsLoading(false),
                      onRequestSuccess: () => {
                        toast({
                          title: "Success",
                          description: `${invite.email}'s invite was canceled`,
                        });

                        router.refresh();
                      },
                    }
                  );
                }}
              >
                Cancel Invitation
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function UsersTable({
  members,
  currentUserId,
  currentUserRole,
  orgName,
}: {
  members: OrgUserWithDetail[];
  currentUserId: string;
  currentUserRole: Role;
  orgName: string;
}) {
  const router = useRouter();

  const [isLoading, setIsLoading] = React.useState(false);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="flex grow items-center font-medium">
              <Avatar className="mr-2">
                <AvatarImage src={member.photoUrl} />
                <AvatarFallback>
                  {member.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold">
                  {member.displayName ?? member.email}
                </p>
                <p>{!!member.displayName && <>{member.email}</>}</p>
              </div>
            </TableCell>
            <TableCell>
              <RoleSelect
                defaultValue={member.role}
                onChange={async (role) => {
                  clientFetch(
                    `/api/orgs/${orgName}/users`,
                    {
                      method: "PATCH",
                      body: JSON.stringify({
                        org_user_id: member.id,
                        role,
                      }),
                    },
                    {
                      beforeRequestStart: () => setIsLoading(true),
                      afterRequestFinish: () => setIsLoading(false),
                      onRequestSuccess: () => {
                        toast({
                          title: "Success",
                          description: `${
                            member.email
                          }'s role was changed to ${roleToUserDescription(
                            role
                          )}`,
                        });

                        router.refresh();
                      },
                    }
                  );
                }}
                disabled={
                  member.userId === currentUserId ||
                  currentUserRole !== Role.ADMIN ||
                  isLoading
                }
              />
            </TableCell>
            <TableCell>
              <Button
                variant="outline"
                disabled={
                  member.userId === currentUserId ||
                  currentUserRole !== Role.ADMIN
                }
                loading={isLoading}
                onClick={async () => {
                  clientFetch(
                    `/api/orgs/${orgName}/users`,
                    {
                      method: "DELETE",
                      body: JSON.stringify({
                        org_user_id: member.id,
                      }),
                    },
                    {
                      beforeRequestStart: () => setIsLoading(true),
                      afterRequestFinish: () => setIsLoading(false),
                      onRequestSuccess: () => {
                        toast({
                          title: "Success",
                          description: `${member.email} was removed from this org`,
                        });

                        router.refresh();
                      },
                    }
                  );
                }}
              >
                Remove
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface OrgUsersProps {
  members: OrgUserWithDetail[];
  invites: OrgInvite[];
  orgName: string;
  currentUserId: string;
}

export function OrgUsers({
  members,
  invites,
  orgName,
  currentUserId,
}: OrgUsersProps) {
  const [inviteModalOpen, setInviteModalOpen] = React.useState(false);

  const currentUserRole =
    members.find((member) => member.userId === currentUserId)?.role ||
    Role.READ;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Members
            <Button
              onClick={() => setInviteModalOpen(true)}
              disabled={currentUserRole !== Role.ADMIN}
            >
              Invite Member
            </Button>
          </CardTitle>
          <CardDescription>
            All members with access to the <strong>{orgName}</strong>{" "}
            organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="members">
            <TabsList className="grid grid-cols-2 md:w-[400px]">
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="invites">Invites</TabsTrigger>
            </TabsList>
            <TabsContent value="members">
              <UsersTable
                members={members}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                orgName={orgName}
              />
            </TabsContent>
            <TabsContent value="invites">
              <InviteTable
                invites={invites}
                currentUserRole={currentUserRole}
                orgName={orgName}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <InviteModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        orgName={orgName}
      />
    </>
  );
}
