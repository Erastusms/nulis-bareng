"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Uncaught application error:", error);
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md border-destructive/50">
        <CardHeader>
          <div className="flex items-center space-x-2 text-destructive">
            <AlertCircle className="h-6 w-6" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            An unexpected error occurred. You can attempt to recover by reloading the state.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
            {error.message || "Unknown error"}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={() => reset()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
