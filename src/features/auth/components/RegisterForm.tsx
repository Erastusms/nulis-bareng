"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Lock, Mail, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppError } from "@/lib/api/errors";
import { useRegister } from "../hooks/use-auth";
import { registerFormSchema } from "../schemas/auth.schema";

export function RegisterForm() {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const registerMutation = useRegister();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    const validationResult = registerFormSchema.safeParse({
      name,
      email,
      password,
      confirmPassword,
    });

    if (!validationResult.success) {
      const formatted = validationResult.error.flatten().fieldErrors;
      setFieldErrors({
        name: formatted.name?.[0],
        email: formatted.email?.[0],
        password: formatted.password?.[0],
        confirmPassword: formatted.confirmPassword?.[0],
      });
      return;
    }

    try {
      await registerMutation.mutateAsync({
        name: validationResult.data.name,
        email: validationResult.data.email,
        password: validationResult.data.password,
      });
      router.push("/");
      router.refresh();
    } catch (error) {
      if (error instanceof AppError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to create account. Please try again.");
      }
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg border-border">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">Create an account</CardTitle>
        <CardDescription>
          Get started with your collaborative real-time workspace
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="register-name">
              Full Name
            </label>
            <div className="relative">
              <Input
                id="register-name"
                type="text"
                placeholder="Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={Boolean(fieldErrors.name)}
                disabled={registerMutation.isPending}
                autoComplete="name"
                required
                className="pl-9"
              />
              <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            {fieldErrors.name && (
              <p className="text-xs text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="register-email">
              Email address
            </label>
            <div className="relative">
              <Input
                id="register-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={Boolean(fieldErrors.email)}
                disabled={registerMutation.isPending}
                autoComplete="email"
                required
                className="pl-9"
              />
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            {fieldErrors.email && (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="register-password">
              Password
            </label>
            <div className="relative">
              <Input
                id="register-password"
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={Boolean(fieldErrors.password)}
                disabled={registerMutation.isPending}
                autoComplete="new-password"
                required
                className="pl-9"
              />
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            {fieldErrors.password && (
              <p className="text-xs text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="register-confirm-password">
              Confirm Password
            </label>
            <div className="relative">
              <Input
                id="register-confirm-password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={Boolean(fieldErrors.confirmPassword)}
                disabled={registerMutation.isPending}
                autoComplete="new-password"
                required
                className="pl-9"
              />
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full font-medium"
            isLoading={registerMutation.isPending}
          >
            Create Account
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
