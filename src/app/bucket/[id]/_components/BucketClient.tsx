"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { initiateSettlement, respondToSettlement } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Copy,
  Check,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Receipt,
} from "lucide-react";
import type { BucketSummary } from "@/lib/types";
import AddExpenseModal from "./AddExpenseModal";
import { formatCents } from "@/lib/utils";

interface Props {
  summary: BucketSummary;
  currentUserId: string;
}

export default function BucketClient({ summary, currentUserId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<{
    receiverId: string;
    receiverName: string | null;
    amountCents: number;
  } | null>(null);

  const { bucket, members, balances, pendingSettlements, recentExpenses } =
    summary;

  const iOwe = balances.filter((b) => b.netCents > 0);
  const owedToMe = balances.filter((b) => b.netCents < 0);
  const myPendingIncoming = pendingSettlements.filter(
    (s) => s.receiverId === currentUserId
  );
  const myPendingOutgoing = pendingSettlements.filter(
    (s) => s.payerId === currentUserId
  );

  function copyCode() {
    navigator.clipboard.writeText(bucket.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRespond(
    settlementId: string,
    response: "CONFIRMED" | "REJECTED"
  ) {
    const fd = new FormData();
    fd.set("settlementId", settlementId);
    fd.set("response", response);
    startTransition(async () => {
      await respondToSettlement(fd);
      router.refresh();
    });
  }

  function handleMarkPaid() {
    if (!markPaidTarget) return;
    const fd = new FormData();
    fd.set("bucketId", bucket.id);
    fd.set("receiverId", markPaidTarget.receiverId);
    fd.set("amountCents", String(markPaidTarget.amountCents));
    startTransition(async () => {
      await initiateSettlement(fd);
      setMarkPaidTarget(null);
      router.refresh();
    });
  }

  const initials = (name: string | null) =>
    name
      ? name
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : "?";

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1 -ml-1 rounded-md hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-semibold truncate leading-tight">
                {bucket.name}
              </h1>
              {bucket.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {bucket.description}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md border px-2.5 py-1.5 transition-colors flex-shrink-0 hover:bg-muted"
            title="Copy invite code"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span className="font-mono tracking-wider">{bucket.inviteCode}</span>
          </button>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-5 space-y-5">
        {myPendingIncoming.length > 0 && (
          <div className="space-y-3">
            {myPendingIncoming.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700"
              >
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    <span className="font-bold">
                      {s.payerName ?? "Someone"}
                    </span>{" "}
                    marked{" "}
                    <span className="font-bold">
                      {formatCents(s.amountCents)}
                    </span>{" "}
                    as paid to you
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                      disabled={isPending}
                      onClick={() => handleRespond(s.id, "CONFIRMED")}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Confirm Received
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      disabled={isPending}
                      onClick={() => handleRespond(s.id, "REJECTED")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Members", value: members.length, color: "" },
            { label: "You Owe", value: iOwe.length, color: "text-red-500" },
            {
              label: "Owed to You",
              value: owedToMe.length,
              color: "text-green-500",
            },
          ].map(({ label, value, color }) => (
            <Card key={label} className="text-center py-3 px-2">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="balances">
          <TabsList className="w-full">
            <TabsTrigger value="balances" className="flex-1">
              Balances
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1">
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="balances" className="mt-4 space-y-5">
            {balances.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-3">
                <div className="h-16 w-16 rounded-2xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
                <p className="font-semibold text-foreground">All settled up!</p>
                <p className="text-sm">
                  No outstanding balances in this bucket.
                </p>
              </div>
            ) : (
              <>
                {iOwe.length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1.5">
                      <TrendingDown className="h-4 w-4" /> You Owe
                    </h3>
                    <div className="space-y-2">
                      {iOwe.map((b) => {
                        const outgoingPending = myPendingOutgoing.find(
                          (s) => s.receiverId === b.counterpartId
                        );
                        return (
                          <Card
                            key={b.counterpartId}
                            className="overflow-hidden"
                          >
                            <CardContent className="flex items-center gap-3 p-4">
                              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-sm font-bold text-red-700 dark:text-red-300 flex-shrink-0">
                                {initials(b.counterpartName)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">
                                  {b.counterpartName ??
                                    b.counterpartId.slice(0, 8)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  You owe{" "}
                                  <span className="text-red-600 dark:text-red-400 font-semibold">
                                    {formatCents(b.netCents)}
                                  </span>
                                </p>
                              </div>
                              {outgoingPending ? (
                                <Badge
                                  variant="secondary"
                                  className="text-xs flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200"
                                >
                                  <Clock className="h-3 w-3" /> Pending
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs flex-shrink-0"
                                  onClick={() =>
                                    setMarkPaidTarget({
                                      receiverId: b.counterpartId,
                                      receiverName: b.counterpartName,
                                      amountCents: b.netCents,
                                    })
                                  }
                                >
                                  Mark Paid
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                )}

                {owedToMe.length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4" /> Owed to You
                    </h3>
                    <div className="space-y-2">
                      {owedToMe.map((b) => {
                        const incomingPending = myPendingIncoming.find(
                          (s) => s.payerId === b.counterpartId
                        );
                        return (
                          <Card
                            key={b.counterpartId}
                            className="overflow-hidden"
                          >
                            <CardContent className="flex items-center gap-3 p-4">
                              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-sm font-bold text-green-700 dark:text-green-300 flex-shrink-0">
                                {initials(b.counterpartName)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">
                                  {b.counterpartName ??
                                    b.counterpartId.slice(0, 8)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Owes you{" "}
                                  <span className="text-green-600 dark:text-green-400 font-semibold">
                                    {formatCents(Math.abs(b.netCents))}
                                  </span>
                                </p>
                              </div>
                              {incomingPending && (
                                <Badge className="text-xs flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200">
                                  <Clock className="h-3 w-3" /> Confirming…
                                </Badge>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            {recentExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-3">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                  <Receipt className="h-8 w-8 opacity-40" />
                </div>
                <p className="font-semibold text-foreground">No expenses yet</p>
                <p className="text-sm">Tap + to add your first expense.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentExpenses.map((e) => (
                  <Card key={e.id}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {e.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {e.payerName ?? "Unknown"} ·{" "}
                          <span className="capitalize">{e.mode}</span> ·{" "}
                          {new Date(e.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <span className="text-sm font-semibold flex-shrink-0">
                        {formatCents(e.totalAmountCents)}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <div className="fixed bottom-6 right-4 sm:right-6 z-50">
        <Button
          size="icon"
          className="rounded-full h-14 w-14 shadow-xl shadow-primary/30 p-0 flex items-center justify-center bg-primary hover:bg-primary/90 text-white"
          onClick={() => setAddOpen(true)}
          aria-label="Add expense"
        >
          <Plus className="h-7 w-7 text-white" strokeWidth={2.5} />
        </Button>
      </div>

      <AddExpenseModal
        members={members}
        bucketId={bucket.id}
        currentUserId={currentUserId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />

      <Dialog
        open={!!markPaidTarget}
        onOpenChange={(o) => !o && setMarkPaidTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Mark{" "}
              <span className="font-bold text-foreground">
                {formatCents(markPaidTarget?.amountCents ?? 0)}
              </span>{" "}
              as paid to{" "}
              <span className="font-bold text-foreground">
                {markPaidTarget?.receiverName ?? "them"}
              </span>
              ?
              <br />
              <span className="text-xs">
                They&apos;ll receive a notification and must confirm receipt.
              </span>
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleMarkPaid}
                disabled={isPending}
              >
                {isPending ? "Sending…" : "Mark as Paid"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setMarkPaidTarget(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
