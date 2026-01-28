"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { clientFetch } from "@/lib/fetch";
import { orgNameUpdateSchema } from "@/lib/validations/orgs";
import { cn } from "components/lib/utils";
import { Button } from "components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import { Input } from "components/ui/input";
import { Label } from "components/ui/label";
import { toast } from "components/ui/use-toast";
import { Role } from "shared/src/types/role";

interface OrgNameFormProps extends React.HTMLAttributes<HTMLFormElement> {
  orgId: string;
  orgName: string;
  role: Role;
}

type FormData = z.infer<typeof orgNameUpdateSchema>;

export function OrgNameForm({
  orgId,
  orgName,
  role,
  className,
  ...props
}: OrgNameFormProps) {
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(orgNameUpdateSchema),
    defaultValues: {
      name: orgName || "",
    },
  });
  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  async function onSubmit(data: FormData) {
    clientFetch(
      `/api/orgs/${orgName}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: data.name,
        }),
      },
      {
        beforeRequestStart: () => setIsSaving(true),
        afterRequestFinish: () => setIsSaving(false),
        onRequestSuccess: () => {
          toast({
            description: "Your name has been updated.",
          });

          // Note: this is using normal browser navigation to refresh the layout (to get OrgSelector to update)
          window.location.href = `/${data.name}/settings`;
        },
        defaultErrorMessage: "Your name was not updated. Please try again.",
      }
    );
  }

  return (
    <form
      className={cn(className)}
      onSubmit={handleSubmit(onSubmit)}
      {...props}
    >
      <Card>
        <CardHeader>
          <CardTitle>Organization Name</CardTitle>
          <CardDescription></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-1">
            <Label className="sr-only" htmlFor="name">
              Name
            </Label>
            <Input
              id="name"
              className="md:w-[400px]"
              size={32}
              disabled={role !== Role.ADMIN}
              {...register("name")}
            />
            {errors?.name && (
              <p className="px-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className={className}
            loading={isSaving}
            disabled={role !== Role.ADMIN}
          >
            Save
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
