"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BucketMemberInfo } from "@/lib/types";
import { addExpense } from "@/app/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap } from "lucide-react";

interface Props {
  members: BucketMemberInfo[];
  bucketId: string;
  currentUserId: string;
  open: boolean;
  onClose: () => void;
}

export default function AddExpenseModal({
  members,
  bucketId,
  currentUserId,
  open,
  onClose,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"split" | "direct">("split");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const me = members.find((m) => m.userId === currentUserId);
  const others = members.filter((m) => m.userId !== currentUserId);
  const lastSubset = me?.lastSubsetIds ?? [];
  const lastSubsetNames = lastSubset
    .map((id) => members.find((m) => m.userId === id)?.name ?? "?")
    .join(", ");

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function applyLastSubset() {
    setSelected(lastSubset.filter((id) => id !== currentUserId));
  }

  function handleClose() {
    setMode("split");
    setSelected([]);
    setError(null);
    onClose();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("bucketId", bucketId);
    fd.set("mode", mode);

    if (mode === "split") {
      const participants = selected.includes(currentUserId)
        ? selected
        : [currentUserId, ...selected];
      if (participants.length < 1) {
        setError("Select at least one participant");
        return;
      }
      participants.forEach((id) => fd.append("participants", id));
    }

    startTransition(async () => {
      try {
        await addExpense(fd);
        router.refresh();
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add expense");
      }
    });
  }

  const displayName = (m: BucketMemberInfo) =>
    m.name ?? m.email ?? m.userId.slice(0, 8);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>

        <div className="flex rounded-lg border overflow-hidden flex-shrink-0">
          {(["split", "direct"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setSelected([]);
                setError(null);
              }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {m === "split" ? "Split Cost" : "X Owes Y"}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 overflow-y-auto flex-1 pr-0.5"
        >
          <div className="space-y-2">
            <Label htmlFor="exp-desc">Description</Label>
            <Input
              id="exp-desc"
              name="description"
              placeholder="Dinner, petrol, groceries..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exp-amount">Amount (₹)</Label>
            <Input
              id="exp-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              required
            />
          </div>

          {mode === "split" ? (
            <div className="space-y-3">
              <Label>Split among</Label>

              {lastSubset.length > 0 && (
                <button
                  type="button"
                  onClick={applyLastSubset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-medium hover:bg-primary/10 transition-colors"
                >
                  <Zap className="h-3 w-3" />
                  Use Last Subset ({lastSubsetNames})
                </button>
              )}

              <div className="space-y-1 max-h-52 overflow-y-auto rounded-lg border p-2">
                <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-muted/40">
                  <Checkbox checked disabled className="opacity-70" />
                  <span className="text-sm font-medium">
                    {me ? displayName(me) : "You"}{" "}
                    <span className="text-xs text-muted-foreground font-normal">
                      (you — payer)
                    </span>
                  </span>
                </div>
                {others.map((m) => (
                  <label
                    key={m.userId}
                    className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selected.includes(m.userId)}
                      onCheckedChange={() => toggle(m.userId)}
                    />
                    <span className="text-sm">{displayName(m)}</span>
                  </label>
                ))}
              </div>

              {selected.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No others selected — expense recorded for you only.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="exp-debtor">Who owes you?</Label>
              <select
                id="exp-debtor"
                name="debtorId"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select a member...
                </option>
                {others.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {displayName(m)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 flex-shrink-0">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full flex-shrink-0" disabled={isPending}>
            {isPending ? "Adding..." : "Add Expense"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
