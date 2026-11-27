"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  Check,
  History,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import type {
  Expense,
  Member,
  PaymentMethod,
  PayerEntry,
  SplitEntry,
  SplitMode,
} from "@/types/trip";
import { formatDateTime, formatINR, round2 } from "@/utils/currency";
import { MemberAvatar } from "@/components/MemberAvatar";

interface ExpenseModalProps {
  isOpen: boolean;
  members: Member[];
  initialExpense?: Expense | null;
  onClose: () => void;
  onSave: (expense: Omit<Expense, "id">) => void;
  onDelete?: (expenseId: string) => void;
}

export function ExpenseModal(props: ExpenseModalProps) {
  if (!props.isOpen) return null;
  return (
    <ExpenseModalInner
      key={props.initialExpense?.id ?? "new"}
      members={props.members}
      initialExpense={props.initialExpense}
      onClose={props.onClose}
      onSave={props.onSave}
      onDelete={props.onDelete}
    />
  );
}

function toLocalDateTimeInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 16);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function ExpenseModalInner({
  members,
  initialExpense,
  onClose,
  onSave,
  onDelete,
}: Omit<ExpenseModalProps, "isOpen">) {
  const [title, setTitle] = useState(() => initialExpense?.title ?? "");
  const [amountStr, setAmountStr] = useState(() =>
    initialExpense ? String(initialExpense.amount) : ""
  );
  const [dateTime, setDateTime] = useState(() =>
    toLocalDateTimeInput(initialExpense?.date)
  );
  const [notes, setNotes] = useState(() => initialExpense?.notes ?? "");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    () => initialExpense?.paymentMethod ?? "upi"
  );
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(
    () => {
      const map: Record<string, string> = {};
      for (const m of members) {
        const found = initialExpense?.payers.find((p) => p.memberId === m.id);
        map[m.id] = found ? String(found.amount) : "";
      }
      return map;
    }
  );

  const [splitMode, setSplitMode] = useState<SplitMode>(
    () => initialExpense?.splitMode ?? "equal"
  );
  const [equalIncluded, setEqualIncluded] = useState<Record<string, boolean>>(
    () => {
      const map: Record<string, boolean> = {};
      for (const m of members) {
        if (initialExpense) {
          const found = initialExpense.splits.find((s) => s.memberId === m.id);
          map[m.id] = Boolean(found && found.share > 0);
        } else {
          map[m.id] = true;
        }
      }
      return map;
    }
  );
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(
    () => {
      const map: Record<string, string> = {};
      for (const m of members) {
        const found = initialExpense?.splits.find((s) => s.memberId === m.id);
        map[m.id] = found ? String(found.share) : "";
      }
      return map;
    }
  );
  const [ratioWeights, setRatioWeights] = useState<Record<string, number>>(
    () => {
      const map: Record<string, number> = {};
      for (const m of members) {
        if (initialExpense) {
          const found = initialExpense.splits.find((s) => s.memberId === m.id);
          map[m.id] = found?.weight ?? (found && found.share > 0 ? 1 : 0);
        } else {
          map[m.id] = 1;
        }
      }
      return map;
    }
  );
  const [error, setError] = useState<string | null>(null);

  const totalAmount = useMemo(() => {
    const n = parseFloat(amountStr);
    return Number.isFinite(n) && n > 0 ? round2(n) : 0;
  }, [amountStr]);

  const payerSum = useMemo(() => {
    return round2(
      members.reduce((sum, m) => {
        const v = parseFloat(payerAmounts[m.id] || "0");
        return sum + (Number.isFinite(v) && v > 0 ? v : 0);
      }, 0)
    );
  }, [members, payerAmounts]);

  const exactSum = useMemo(() => {
    return round2(
      members.reduce((sum, m) => {
        const v = parseFloat(exactAmounts[m.id] || "0");
        return sum + (Number.isFinite(v) && v > 0 ? v : 0);
      }, 0)
    );
  }, [members, exactAmounts]);

  const includedEqualMembers = useMemo(
    () => members.filter((m) => equalIncluded[m.id]),
    [members, equalIncluded]
  );

  const totalRatioWeight = useMemo(
    () => members.reduce((sum, m) => sum + (ratioWeights[m.id] || 0), 0),
    [members, ratioWeights]
  );

  const handleAssignFullBill = (memberId: string) => {
    const next: Record<string, string> = {};
    for (const m of members) {
      next[m.id] =
        m.id === memberId && totalAmount > 0 ? String(totalAmount) : "";
    }
    setPayerAmounts(next);
  };

  const handleSplitPaymentEqually = () => {
    if (totalAmount <= 0 || members.length === 0) return;
    const raw = round2(totalAmount / members.length);
    let running = 0;
    const next: Record<string, string> = {};
    members.forEach((m, idx) => {
      if (idx === members.length - 1) {
        next[m.id] = String(round2(totalAmount - running));
      } else {
        running = round2(running + raw);
        next[m.id] = String(raw);
      }
    });
    setPayerAmounts(next);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please enter a bill title.");
      return;
    }
    if (totalAmount <= 0) {
      setError("Please enter a valid bill amount greater than ₹0.");
      return;
    }

    const payers: PayerEntry[] = members
      .map((m) => ({
        memberId: m.id,
        amount: round2(parseFloat(payerAmounts[m.id] || "0") || 0),
        method: paymentMethod,
      }))
      .filter((p) => p.amount > 0);

    if (payers.length === 0) {
      setError("Assign who paid the bill (tap 'Full Bill' or enter amounts).");
      return;
    }
    if (Math.abs(payerSum - totalAmount) > 0.05) {
      setError(
        `Sum of payers (${formatINR(payerSum)}) must equal total bill (${formatINR(totalAmount)}).`
      );
      return;
    }

    let splits: SplitEntry[] = [];
    if (splitMode === "equal") {
      if (includedEqualMembers.length === 0) {
        setError("Select at least one person who consumed this bill.");
        return;
      }
      const rawShare = round2(totalAmount / includedEqualMembers.length);
      let runningSum = 0;
      splits = includedEqualMembers.map((m, idx) => {
        if (idx === includedEqualMembers.length - 1) {
          return { memberId: m.id, share: round2(totalAmount - runningSum) };
        }
        runningSum = round2(runningSum + rawShare);
        return { memberId: m.id, share: rawShare };
      });
    } else if (splitMode === "exact") {
      splits = members
        .map((m) => ({
          memberId: m.id,
          share: round2(parseFloat(exactAmounts[m.id] || "0") || 0),
        }))
        .filter((s) => s.share > 0);

      if (Math.abs(exactSum - totalAmount) > 0.05) {
        setError(
          `Exact shares (${formatINR(exactSum)}) must equal total bill (${formatINR(totalAmount)}).`
        );
        return;
      }
    } else {
      if (totalRatioWeight <= 0) {
        setError("Set at least one member's ratio above 0x.");
        return;
      }
      const activeRatioMembers = members.filter(
        (m) => (ratioWeights[m.id] || 0) > 0
      );
      let runningSum = 0;
      splits = activeRatioMembers.map((m, idx) => {
        const w = ratioWeights[m.id] || 0;
        if (idx === activeRatioMembers.length - 1) {
          return {
            memberId: m.id,
            share: round2(totalAmount - runningSum),
            weight: w,
          };
        }
        const share = round2((totalAmount * w) / totalRatioWeight);
        runningSum = round2(runningSum + share);
        return { memberId: m.id, share, weight: w };
      });
    }

    onSave({
      title: title.trim(),
      amount: totalAmount,
      date: new Date(dateTime).toISOString(),
      paymentMethod,
      payers: payers.map((p) => ({ ...p, method: paymentMethod })),
      splitMode,
      splits,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const payerDiff = round2(totalAmount - payerSum);
  const exactDiff = round2(totalAmount - exactSum);
  const allEqualSelected = includedEqualMembers.length === members.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0f1422] text-zinc-100 shadow-2xl sm:rounded-[28px]">
        {/* Sticky Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0f1422]/95 px-5 py-3.5 backdrop-blur-md">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-white">
              {initialExpense ? "Edit Bill" : "New Trip Bill"}
            </h2>
            <p className="text-[11px] text-zinc-400">
              Log amount, payer & split
            </p>
          </div>
          <div className="flex items-center gap-2">
            {initialExpense && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(initialExpense.id);
                  onClose();
                }}
                className="rounded-xl border border-rose-400/30 bg-rose-500/15 p-2 text-rose-300 transition hover:bg-rose-500/25"
                title="Delete Bill"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/[0.06] p-2 text-zinc-300 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="expense-modal-form"
          onSubmit={handleSave}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
        >
          {/* Hero Amount & Title Card */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-center gap-1.5 py-1">
              <span className="text-2xl font-extrabold text-blue-400">₹</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder="0"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                autoFocus={!initialExpense}
                className="no-spinner w-44 bg-transparent text-center text-4xl font-black tracking-tight text-white placeholder-zinc-600 focus:outline-none tabular-nums"
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-12">
              <input
                type="text"
                placeholder="Bill title (e.g. Resort Stay, Dinner)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="sm:col-span-7 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-white placeholder-zinc-500 focus:border-blue-400 focus:outline-none"
              />
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="sm:col-span-5 rounded-xl border border-white/10 bg-black/40 px-2.5 py-2 text-[11px] font-medium text-zinc-300 focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Paid By Section */}
          <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Paid By
                </span>
                {members.length > 1 && totalAmount > 0 && (
                  <button
                    type="button"
                    onClick={handleSplitPaymentEqually}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-300 hover:bg-white/20 hover:text-white"
                  >
                    Split Evenly
                  </button>
                )}
              </div>

              <div className="inline-flex rounded-full border border-white/10 bg-black/40 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("upi")}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold transition ${
                    paymentMethod === "upi"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Smartphone className="h-3 w-3" />
                  UPI
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold transition ${
                    paymentMethod === "cash"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Banknote className="h-3 w-3" />
                  Cash
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {members.map((m) => {
                const val = parseFloat(payerAmounts[m.id] || "0") || 0;
                const isPaying = val > 0;
                const isFull =
                  totalAmount > 0 && Math.abs(val - totalAmount) < 0.01;

                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between gap-2 rounded-2xl border px-2.5 py-2 transition ${
                      isPaying
                        ? "border-blue-400/40 bg-blue-500/10"
                        : "border-white/[0.05] bg-black/25"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <MemberAvatar member={m} size="sm" />
                      <p className="truncate text-xs font-bold text-white">
                        {m.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAssignFullBill(m.id)}
                        disabled={totalAmount <= 0}
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition disabled:opacity-40 ${
                          isFull
                            ? "border-blue-500 bg-blue-600 text-white"
                            : "border-white/10 bg-white/[0.06] text-zinc-300 hover:border-blue-400/50 hover:text-blue-300"
                        }`}
                      >
                        Full Bill
                      </button>
                      <div className="relative w-24">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-500">
                          ₹
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          placeholder="0"
                          value={payerAmounts[m.id] ?? ""}
                          onChange={(e) =>
                            setPayerAmounts((prev) => ({
                              ...prev,
                              [m.id]: e.target.value,
                            }))
                          }
                          className="no-spinner w-full rounded-xl border border-white/10 bg-black/50 py-1.5 pl-6 pr-2.5 text-right text-xs font-bold text-white focus:border-blue-400 focus:outline-none tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.08] pt-2 text-[11px]">
              <span className="text-zinc-400 tabular-nums">
                Assigned: {formatINR(payerSum)} / {formatINR(totalAmount)}
              </span>
              {totalAmount <= 0 ? (
                <span className="font-medium text-zinc-500">
                  Enter bill amount above
                </span>
              ) : Math.abs(payerDiff) <= 0.05 ? (
                <span className="font-bold text-emerald-400">
                  Matched ✓
                </span>
              ) : payerDiff > 0 ? (
                <span className="font-bold text-amber-300 tabular-nums">
                  Remaining: {formatINR(payerDiff)}
                </span>
              ) : (
                <span className="font-bold text-rose-400 tabular-nums">
                  Over by: {formatINR(Math.abs(payerDiff))}
                </span>
              )}
            </div>
          </div>

          {/* Who Consumed Section */}
          <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Split Among
                </span>
                {splitMode === "equal" && (
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, boolean> = {};
                      for (const m of members) {
                        next[m.id] = !allEqualSelected;
                      }
                      setEqualIncluded(next);
                    }}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-300 hover:bg-white/20 hover:text-white"
                  >
                    {allEqualSelected ? "Clear" : "Select All"}
                  </button>
                )}
              </div>

              <div className="inline-flex rounded-full border border-white/10 bg-black/40 p-0.5 text-[11px]">
                {(["equal", "exact", "ratio"] as SplitMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSplitMode(mode)}
                    className={`rounded-full px-2.5 py-1 font-bold capitalize transition ${
                      splitMode === mode
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {splitMode === "equal" && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => {
                    const active = Boolean(equalIncluded[m.id]);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setEqualIncluded((prev) => ({
                            ...prev,
                            [m.id]: !prev[m.id],
                          }))
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold transition ${
                          active
                            ? "border-blue-400/40 bg-blue-500/15 text-blue-200 shadow-sm"
                            : "border-white/10 bg-black/30 text-zinc-500 line-through"
                        }`}
                      >
                        <MemberAvatar member={m} size="sm" />
                        {m.name}
                        {active && <Check className="h-3 w-3 text-blue-400" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] font-medium text-zinc-400 tabular-nums">
                  {includedEqualMembers.length > 0
                    ? `${formatINR(totalAmount / includedEqualMembers.length)} / person · ${includedEqualMembers.length} of ${members.length} selected`
                    : "Tap members to include in split"}
                </p>
              </div>
            )}

            {splitMode === "exact" && (
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <MemberAvatar member={m} size="sm" />
                      <span className="text-xs font-bold text-zinc-200">
                        {m.name}
                      </span>
                    </div>
                    <div className="relative w-28">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                        ₹
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        placeholder="0"
                        value={exactAmounts[m.id] ?? ""}
                        onChange={(e) =>
                          setExactAmounts((prev) => ({
                            ...prev,
                            [m.id]: e.target.value,
                          }))
                        }
                        className="no-spinner w-full rounded-xl border border-white/10 bg-black/50 py-1.5 pl-6 pr-2.5 text-right text-xs font-bold text-white focus:border-blue-400 focus:outline-none tabular-nums"
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-white/[0.08] pt-2 text-[11px]">
                  <span className="text-zinc-400 tabular-nums">
                    Assigned: {formatINR(exactSum)} / {formatINR(totalAmount)}
                  </span>
                  {totalAmount <= 0 ? (
                    <span className="text-zinc-500">Enter bill amount</span>
                  ) : Math.abs(exactDiff) <= 0.05 ? (
                    <span className="font-bold text-emerald-400">
                      Remaining: ₹0 ✓
                    </span>
                  ) : exactDiff > 0 ? (
                    <span className="font-bold text-amber-300 tabular-nums">
                      Remaining: {formatINR(exactDiff)}
                    </span>
                  ) : (
                    <span className="font-bold text-rose-400 tabular-nums">
                      Over by: {formatINR(Math.abs(exactDiff))}
                    </span>
                  )}
                </div>
              </div>
            )}

            {splitMode === "ratio" && (
              <div className="space-y-2">
                {members.map((m) => {
                  const w = ratioWeights[m.id] ?? 0;
                  const share =
                    totalRatioWeight > 0
                      ? (totalAmount * w) / totalRatioWeight
                      : 0;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <MemberAvatar member={m} size="sm" />
                        <div>
                          <p className="text-xs font-bold text-white">
                            {m.name}
                          </p>
                          <p className="text-[10px] font-medium text-zinc-400 tabular-nums">
                            {formatINR(share)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setRatioWeights((prev) => ({
                              ...prev,
                              [m.id]: Math.max(0, (prev[m.id] ?? 1) - 1),
                            }))
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-xs font-bold text-zinc-200 hover:bg-white/10"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-blue-300 tabular-nums">
                          {w}x
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRatioWeights((prev) => ({
                              ...prev,
                              [m.id]: (prev[m.id] ?? 0) + 1,
                            }))
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-xs font-bold text-zinc-200 hover:bg-white/10"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <input
            type="text"
            placeholder="Optional note (e.g. Excluded drinks)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-blue-400 focus:outline-none"
          />

          {initialExpense?.editHistory && initialExpense.editHistory.length > 0 && (
            <div className="space-y-2 rounded-3xl border border-amber-400/25 bg-amber-500/10 p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                <History className="h-3.5 w-3.5" />
                Edit History ({initialExpense.editHistory.length})
              </div>
              <div className="space-y-2">
                {initialExpense.editHistory.map((entry, idx) => (
                  <div
                    key={`${entry.editedAt}-${idx}`}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px]"
                  >
                    <p className="font-bold text-amber-200">
                      {formatDateTime(entry.editedAt)}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-zinc-300">
                      {entry.changes.map((ch, cIdx) => (
                        <li key={cIdx}>• {ch}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Sticky Footer CTA */}
        <div className="shrink-0 space-y-2 border-t border-white/[0.08] bg-[#0f1422]/95 px-5 py-3.5 pb-safe backdrop-blur-md">
          {error && (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/15 px-3.5 py-2 text-xs font-semibold text-rose-200">
              {error}
            </div>
          )}
          <button
            type="submit"
            form="expense-modal-form"
            className="w-full rounded-full bg-gradient-to-r from-blue-600 to-sky-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 active:scale-[0.99]"
          >
            {initialExpense ? "Save Changes" : "Save Bill"}
          </button>
        </div>
      </div>
    </div>
  );
}
