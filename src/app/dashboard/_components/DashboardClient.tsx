"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createBucket,
  joinBucket,
  markNotificationRead,
  signOutAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Plus,
  Users,
  LogOut,
  Wallet,
  ChevronRight,
  UserPlus,
  X,
} from "lucide-react";
import type { AppNotification, BucketListItem } from "@/lib/types";

interface Props {
  buckets: BucketListItem[];
  notifications: AppNotification[];
  user: { name?: string | null; email?: string | null; image?: string | null; id: string };
}

export default function DashboardClient({ buckets, notifications, user }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const { bucketId } = await createBucket(fd);
        setCreateOpen(false);
        router.push(`/bucket/${bucketId}`);
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : "Failed to create");
      }
    });
  }

  function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setJoinError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const { bucketId } = await joinBucket(fd);
        setJoinOpen(false);
        router.push(`/bucket/${bucketId}`);
      } catch (err) {
        setJoinError(err instanceof Error ? err.message : "Invalid invite code");
      }
    });
  }

  function dismiss(id: string) {
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">Bucket Split</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-0.5 -right-0.5 h-5 min-w-5 rounded-full px-1 flex items-center justify-center text-[10px] font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-11 w-80 rounded-xl border bg-popover shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b flex items-center justify-between">
                      <p className="font-semibold text-sm">Notifications</p>
                      {unreadCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {unreadCount} unread
                        </Badge>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y">
                      {notifications.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          All caught up! 🎉
                        </p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`flex items-start gap-2 px-4 py-3 ${!n.read ? "bg-primary/5" : ""}`}
                          >
                            {!n.read && (
                              <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                            )}
                            <p className="text-xs flex-1 leading-relaxed text-foreground/90">
                              {n.message}
                            </p>
                            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                              {n.bucketId && (
                                <Link
                                  href={`/bucket/${n.bucketId}`}
                                  className="text-xs text-primary hover:underline font-medium"
                                  onClick={() => setNotifOpen(false)}
                                >
                                  View
                                </Link>
                              )}
                              {!n.read && (
                                <button
                                  onClick={() => dismiss(n.id)}
                                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <form action={signOutAction}>
              <button
                type="submit"
                className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Hey, {firstName}!</h2>
            <p className="text-sm text-muted-foreground">Your shared expense buckets</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={joinOpen} onOpenChange={(o) => { setJoinOpen(o); setJoinError(null); }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Join
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Join a Bucket</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleJoin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="join-code">Invite Code</Label>
                    <Input
                      id="join-code"
                      name="code"
                      placeholder="e.g. ABCD1234"
                      className="font-mono uppercase tracking-widest"
                      autoComplete="off"
                      required
                    />
                  </div>
                  {joinError && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                      {joinError}
                    </p>
                  )}
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? "Joining..." : "Join Bucket"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); setCreateError(null); }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Create Bucket</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-name">Name</Label>
                    <Input
                      id="create-name"
                      name="name"
                      placeholder="Goa Trip, Flat Rent, Team Lunch..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-desc">Description (optional)</Label>
                    <Input
                      id="create-desc"
                      name="description"
                      placeholder="Brief description..."
                    />
                  </div>
                  {createError && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                      {createError}
                    </p>
                  )}
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? "Creating..." : "Create Bucket"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {buckets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-3">
            <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center">
              <Wallet className="h-10 w-10 opacity-40" />
            </div>
            <p className="font-semibold text-lg text-foreground">No buckets yet</p>
            <p className="text-sm max-w-xs">
              Create a new bucket or join one with an invite code to start splitting expenses.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {buckets.map(({ bucket, memberCount }) => (
              <Link key={bucket.id} href={`/bucket/${bucket.id}`} className="block">
                <Card className="hover:shadow-md transition-all hover:border-primary/30 cursor-pointer group">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Wallet className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{bucket.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {memberCount} member{memberCount !== 1 ? "s" : ""}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {bucket.inviteCode}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
