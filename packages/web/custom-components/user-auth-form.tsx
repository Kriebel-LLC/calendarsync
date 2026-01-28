"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Icons } from "@/custom-components/icons";
import { EventNames, identify, track } from "@/lib/amplitude";
import {
  PersonalDashboardRoute,
  RedirectQueryParameterKey,
} from "@/lib/constants";
import { auth } from "@/lib/firebase";
import { userAuthSchema } from "@/lib/validations/auth";
import { cn } from "components/lib/utils";
import { buttonVariants } from "components/ui/button";
import { Input } from "components/ui/input";
import { Label } from "components/ui/label";
import { toast } from "components/ui/use-toast";
import {
  GoogleAuthProvider,
  UserCredential,
  getAdditionalUserInfo,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
} from "firebase/auth";

const provider = new GoogleAuthProvider();

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

type FormData = z.infer<typeof userAuthSchema>;

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(userAuthSchema),
  });
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState<boolean>(false);

  const completeSignIn = async (result: UserCredential) => {
    const idToken = await result.user.getIdToken();
    const isNewUser = (await getAdditionalUserInfo(result))?.isNewUser;
    await fetch(`/api/${isNewUser ? "signup" : "login"}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    identify(result.user.uid, {
      "email verified": result.user.emailVerified,
      "display name": result.user.displayName,
      email: result.user.email,
      "creation time": result.user.metadata.creationTime,
      "last sign in time": result.user.metadata.lastSignInTime,
    });
    track(
      isNewUser ? EventNames.SIGN_IN : EventNames.SIGN_UP,
      result.user.uid,
      { success: true }
    );

    const redirectParam = params?.get(RedirectQueryParameterKey);
    if (redirectParam) {
      const redirectURL = decodeURIComponent(redirectParam);

      router.push(redirectURL);
      return;
    }

    router.push(`/${PersonalDashboardRoute}`);
  };

  // NOTE: locally, this may fire twice due to React strict mode, causing errors that can be ignored locally
  // local errors should call signInWithEmailLink 2x, causing the 2nd to fail only, but should not block
  React.useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      setIsLoading(true);
      // Additional state parameters can also be passed via URL.
      // This can be used to continue the user's intended action before triggering
      // the sign-in operation.
      // Get the email if available. This should be available if the user completes
      // the flow on the same device where they started it.
      let email = window.localStorage.getItem("emailForSignIn");
      if (!email) {
        // User opened the link on a different device. To prevent session fixation
        // attacks, ask the user to provide the associated email again. For example:
        email = window.prompt("Please provide your email for confirmation");
      }

      signInWithEmailLink(auth, email as string, window.location.href)
        .then(async (result) => {
          // Clear email from storage.
          window.localStorage.removeItem("emailForSignIn");
          // You can access the new user via result.user
          // Additional user info profile not available via:
          // result.additionalUserInfo.profile == null
          // You can check if the user is new or existing:
          // result.additionalUserInfo.isNewUser
          await completeSignIn(result);
        })
        .catch(() => {
          toast({
            title: "Something went wrong",
            description: "Couldn't activate with that email. Try again",
            variant: "destructive",
          });
        })
        .finally(() => setIsLoading(false));
    }
  }, []);

  function onSubmit(data: FormData) {
    setIsLoading(true);

    sendSignInLinkToEmail(auth, data.email, {
      // URL you want to redirect back to. The domain (www.example.com) for this
      // URL must be in the authorized domains list in the Firebase Console.
      url: `${window.location.href}`,
      handleCodeInApp: true, // This must be true.
    })
      .then(() => {
        // The link was successfully sent. Inform the user.
        // Save the email locally so you don't need to ask the user for it again
        // if they open the link on the same device.
        window.localStorage.setItem("emailForSignIn", data.email);

        toast({
          title: "Check your email",
          description:
            "We sent you a login link. Be sure to check your spam too.",
        });
      })
      .catch((error) => {
        console.error(error);
        toast({
          title: "Something went wrong.",
          description: "Your sign in request failed. Please try again.",
          variant: "destructive",
        });
      })
      .finally(() => setIsLoading(false));
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label className="sr-only" htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading || isGoogleLoading}
              {...register("email")}
            />
            {errors?.email && (
              <p className="px-1 text-xs text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>
          <button className={cn(buttonVariants())} disabled={isLoading}>
            {isLoading && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            Sign {pathname === "/register" ? "Up" : "In"} with Email
          </button>
        </div>
      </form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      <button
        type="button"
        className={cn(buttonVariants({ variant: "outline" }))}
        onClick={() => {
          setIsGoogleLoading(true);
          signInWithPopup(auth, provider)
            .then(async (result) => {
              // This gives you a Google Access Token. You can use it to access the Google API.
              // const credential =
              //   GoogleAuthProvider.credentialFromResult(result);
              // const token = credential.accessToken;
              // IdP data available using getAdditionalUserInfo(result)
              await completeSignIn(result);
            })
            .catch((error) => {
              const errorMessage = error.message;
              toast({
                title: "Something went wrong.",
                description: errorMessage,
                variant: "destructive",
              });
            })
            .finally(() => setIsGoogleLoading(false));
        }}
        disabled={isLoading || isGoogleLoading}
      >
        {isGoogleLoading ? (
          <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.google className="mr-2 h-4 w-4" />
        )}{" "}
        Google
      </button>
    </div>
  );
}
