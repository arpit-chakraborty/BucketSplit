"use client";

import { useState, useTransition } from "react";
import { registerUser, loginUser } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Loader2 } from "lucide-react";

export default function SignInPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        if (isSignUp) {
          await registerUser(fd);
        } else {
          await loginUser(fd);
        }
      } catch (err: any) {
        if (err?.digest?.startsWith("NEXT_REDIRECT")) return;
        setError(err instanceof Error ? err.message : "Authentication failed");
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted px-4 py-8">
      <Card className="w-full max-w-sm shadow-xl border-border/80">
        <CardHeader className="text-center space-y-2 pb-3">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Bucket Split</CardTitle>
          <CardDescription>
            {isSignUp ? "Create a new account to get started" : "Welcome back! Sign in to continue"}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2">
          {/* Segmented Tab Control */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg mb-5 text-sm font-medium">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(null); }}
              className={`py-1.5 rounded-md transition-all ${
                !isSignUp
                  ? "bg-background shadow-sm text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(null); }}
              className={`py-1.5 rounded-md transition-all ${
                isSignUp
                  ? "bg-background shadow-sm text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                placeholder="e.g. arpit"
                autoCapitalize="none"
                autoCorrect="off"
                required
                disabled={isPending}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                disabled={isPending}
                className="h-10"
              />
              {isSignUp && (
                <p className="text-[11px] text-muted-foreground">
                  Must be at least 6 characters
                </p>
              )}
            </div>

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-md p-3 border border-destructive/20">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-10 font-medium" disabled={isPending}>
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isSignUp ? "Creating Account..." : "Signing In..."}
                </span>
              ) : (
                isSignUp ? "Create Account" : "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
