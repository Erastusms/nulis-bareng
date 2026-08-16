import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata: Metadata = {
  title: `Register | ${siteConfig.name}`,
  description: "Create an account to start collaborating",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground shadow">
              NB
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">
              {siteConfig.name}
            </span>
          </Link>
        </div>

        <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-lg bg-muted/40" />}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
