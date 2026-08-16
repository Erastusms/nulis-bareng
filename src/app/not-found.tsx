import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="flex flex-col items-center">
          <div className="rounded-full bg-muted p-3">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="mt-4">Page Not Found</CardTitle>
          <CardDescription>
            The page or workspace resource you are looking for does not exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">404 - Not Found</p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/">
            <Button variant="default">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Home
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
