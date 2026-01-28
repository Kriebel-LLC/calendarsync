"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { User, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Icons } from "@/custom-components/icons";
import { clientFetch } from "@/lib/fetch";
import { auth } from "@/lib/firebase";
import { userNameSchema } from "@/lib/validations/user";
import { cn } from "components/lib/utils";
import { buttonVariants } from "components/ui/button";
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

interface UserNameFormProps extends React.HTMLAttributes<HTMLFormElement> {
  user: Pick<User, "uid" | "displayName">;
}

type FormData = z.infer<typeof userNameSchema>;

export function UserNameForm({ user, className, ...props }: UserNameFormProps) {
  const router = useRouter();
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(userNameSchema),
    defaultValues: {
      name: user?.displayName || "",
    },
  });
  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  async function onSubmit(data: FormData) {
    setIsSaving(true);

    if (!auth.currentUser) {
      return;
    }

    await updateProfile(auth.currentUser, {
      displayName: data.name,
    });
    const idToken = await auth.currentUser.getIdToken(true);
    clientFetch(
      "/api/refresh-tokens",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      },
      {
        afterRequestFinish: () => setIsSaving(false),
        onRequestSuccess: () => {
          toast({
            description: "Your name has been updated.",
          });
          router.refresh();
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
          <CardTitle>Your Name</CardTitle>
          <CardDescription>
            Please enter your full name or a display name you are comfortable
            with.
          </CardDescription>
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
              {...register("name")}
            />
            {errors?.name && (
              <p className="px-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <button
            type="submit"
            className={cn(buttonVariants(), className)}
            disabled={isSaving}
          >
            {isSaving && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            <span>Save</span>
          </button>
        </CardFooter>
      </Card>
    </form>
  );
}
