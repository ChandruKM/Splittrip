"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import type { CashTransfer, PaymentMethod, Trip } from "@/types/trip";
import { formatDateTime, formatINR } from "@/utils/currency";
import {
  calculateMemberBalances,
  simplifyDebts,
} from "@/utils/settleDebts";
import { MemberAvatar } from "@/components/MemberAvatar";

interface SettleUpTabProps {
  trip: Trip;
  onMarkSettled: (transfer: Omit<CashTransfer, "id">) => void;
  onDeleteTransfer: (transferId: string) => void;
}

export function SettleUpTab({
  trip,
  onMarkSettled,
  onDeleteTransfer,
}: SettleUpTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [partialKey, setPartialKey] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState("");
  const [partialMethod, setPartialMethod] = useState<PaymentMethod>("upi");

  const balances = calculateMemberBalances(trip);
  const settlements = simplifyDebts(balances);
  const memberById = new Map(trip.members.map((m) => [m.id, m]));

  const settlementTransfers = trip.transfers.filter((t) => t.isSettlement);

  const receivers = balances.filter((b) => b.netBalance > 0.5);
  const payers = balances.filter((b) => b.netBalance < -0.5);

  const totalToReceive = receivers.reduce((sum, b) => sum + b.netBalance, 0);
  const totalToPay = payers.reduce(
    (sum, b) => sum + Math.abs(b.netBalance),
    0
  );

  return (
    <div className="space-y-5 pb-24">
      {/* Detailed Need to Receive & Need to Pay Breakdown */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Need to Receive */}
        <div className="rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-4 backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Need to Receive
              </p>
              <p className="text-[11px] font-medium text-emerald-300/75">
                {receivers.length} {receivers.length === 1 ? "person" : "people"}
              </p>
            </div>
            <p className="text-xl font-black text-emerald-300 tabular-nums">
              +{formatINR(totalToReceive)}
            </p>
          </div>

          <div className="mt-3 space-y-2 border-t border-emerald-400/20 pt-2.5">
            {receivers.length === 0 ? (
              <p className="text-xs text-emerald-300/60">No one to receive</p>
            ) : (
              receivers.map((b) => (
                <div
                  key={b.member.id}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.06] px-2.5 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <MemberAvatar member={b.member} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        {b.member.name}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        Paid {formatINR(b.totalBillsPaid)} · Used{" "}
                        {formatINR(b.totalConsumed)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-extrabold text-emerald-300 tabular-nums">
                    +{formatINR(b.netBalance)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Need to Pay */}
        <div className="rounded-3xl border border-rose-400/25 bg-rose-500/10 p-4 backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                Need to Pay
              </p>
              <p className="text-[11px] font-medium text-rose-300/75">
                {payers.length} {payers.length === 1 ? "person" : "people"}
              </p>
            </div>
            <p className="text-xl font-black text-rose-300 tabular-nums">
              -{formatINR(totalToPay)}
            </p>
          </div>

          <div className="mt-3 space-y-2 border-t border-rose-400/20 pt-2.5">
            {payers.length === 0 ? (
              <p className="text-xs text-rose-300/60">No one needs to pay</p>
            ) : (
              payers.map((b) => (
                <div
                  key={b.member.id}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.06] px-2.5 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <MemberAvatar member={b.member} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        {b.member.name}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        Paid {formatINR(b.totalBillsPaid)} · Used{" "}
                        {formatINR(b.totalConsumed)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-extrabold text-rose-300 tabular-nums">
                    -{formatINR(Math.abs(b.netBalance))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Final Payment Instructions */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            Final Payment Instructions
          </h2>
        </div>

        {settlements.length === 0 ? (
          <div className="flex items-center gap-3 rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-4">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-bold text-emerald-200">
                All settled up!
              </p>
              <p className="text-xs text-emerald-300/75">
                Every friend&apos;s balance is ₹0.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {settlements.map((s) => {
              const from = memberById.get(s.fromMemberId);
              const to = memberById.get(s.toMemberId);
              if (!from || !to) return null;

              const rowKey = `${s.fromMemberId}-${s.toMemberId}`;
              const isPartialOpen = partialKey === rowKey;

              return (
                <div
                  key={rowKey}
                  className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-[#111625]/90 p-3.5 shadow-lg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <MemberAvatar member={from} size="sm" />
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-white">
                        <span>{from.name}</span>
                        <span className="text-zinc-600">──</span>
                        <span className="rounded-lg bg-blue-500/20 px-2 py-0.5 font-extrabold text-blue-300 tabular-nums">
                          {formatINR(s.amount)}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
                        <span className="text-emerald-300">{to.name}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (isPartialOpen) {
                            setPartialKey(null);
                          } else {
                            setPartialKey(rowKey);
                            setPartialAmount("");
                          }
                        }}
                        className={`rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition ${
                          isPartialOpen
                            ? "border-blue-400/50 bg-blue-500/20 text-blue-300"
                            : "border-white/10 bg-white/[0.05] text-zinc-300 hover:border-blue-400/40"
                        }`}
                      >
                        Partial
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onMarkSettled({
                            fromMemberId: s.fromMemberId,
                            toMemberId: s.toMemberId,
                            amount: s.amount,
                            date: new Date().toISOString(),
                            method: "upi",
                            note: "Full settlement",
                            isSettlement: true,
                          })
                        }
                        className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-500 active:scale-95"
                      >
                        Mark Paid ✓
                      </button>
                    </div>
                  </div>

                  {isPartialOpen && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const amt = parseFloat(partialAmount);
                        if (!Number.isFinite(amt) || amt <= 0) return;
                        onMarkSettled({
                          fromMemberId: s.fromMemberId,
                          toMemberId: s.toMemberId,
                          amount: amt,
                          date: new Date().toISOString(),
                          method: partialMethod,
                          note: "Partial settlement",
                          isSettlement: true,
                        });
                        setPartialKey(null);
                        setPartialAmount("");
                      }}
                      className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-2.5"
                    >
                      <div className="relative min-w-0 flex-1">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                          ₹
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0.01"
                          placeholder={`Paid amount (max ${s.amount})`}
                          value={partialAmount}
                          onChange={(e) => setPartialAmount(e.target.value)}
                          autoFocus
                          className="no-spinner w-full rounded-xl border border-white/15 bg-black/40 py-1.5 pl-6 pr-2.5 text-xs font-bold text-white placeholder-zinc-500 focus:border-blue-400 focus:outline-none tabular-nums"
                        />
                      </div>
                      <div className="inline-flex rounded-full border border-white/10 bg-black/40 p-0.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setPartialMethod("upi")}
                          className={`rounded-full px-2 py-1 font-bold ${
                            partialMethod === "upi"
                              ? "bg-blue-600 text-white"
                              : "text-zinc-400"
                          }`}
                        >
                          UPI
                        </button>
                        <button
                          type="button"
                          onClick={() => setPartialMethod("cash")}
                          className={`rounded-full px-2 py-1 font-bold ${
                            partialMethod === "cash"
                              ? "bg-emerald-600 text-white"
                              : "text-zinc-400"
                          }`}
                        >
                          Cash
                        </button>
                      </div>
                      <button
                        type="submit"
                        className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500"
                      >
                        Record
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Individual Status Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            All Members Math
          </h2>
          <span className="text-[11px] text-zinc-500">Tap for details</span>
        </div>

        <div className="space-y-2">
          {balances.map((b) => {
            const isPositive = b.netBalance > 0.5;
            const isNegative = b.netBalance < -0.5;
            const isExpanded = expandedId === b.member.id;

            return (
              <div
                key={b.member.id}
                className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111625]/90"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((prev) =>
                      prev === b.member.id ? null : b.member.id
                    )
                  }
                  className="flex w-full items-center justify-between p-3.5 text-left"
                >
                  <div className="flex items-center gap-3">
                    <MemberAvatar member={b.member} />
                    <div>
                      <p className="text-sm font-bold text-white">
                        {b.member.name}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Paid {formatINR(b.totalBillsPaid)} · Used{" "}
                        {formatINR(b.totalConsumed)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold tabular-nums ${
                        isPositive
                          ? "bg-emerald-500/20 text-emerald-300"
                          : isNegative
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-white/[0.08] text-zinc-400"
                      }`}
                    >
                      {isPositive
                        ? `Need to Receive +${formatINR(b.netBalance)}`
                        : isNegative
                        ? `Need to Pay -${formatINR(Math.abs(b.netBalance))}`
                        : "Settled ✓"}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] bg-black/25 px-4 py-3 text-[11px]">
                    <div>
                      <p className="text-zinc-500">Bills Paid</p>
                      <p className="font-bold text-zinc-100 tabular-nums">
                        {formatINR(b.totalBillsPaid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Share Used</p>
                      <p className="font-bold text-amber-300 tabular-nums">
                        {formatINR(b.totalConsumed)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Marked Paid History */}
      {settlementTransfers.length > 0 && (
        <div className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-widest text-zinc-400">
            Marked Paid
          </h2>
          {settlementTransfers.map((tr) => {
            const from = memberById.get(tr.fromMemberId)?.name ?? "Unknown";
            const to = memberById.get(tr.toMemberId)?.name ?? "Unknown";
            return (
              <div
                key={tr.id}
                className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2 text-zinc-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    {from} paid {formatINR(tr.amount)} to {to}
                  </span>
                  {tr.method && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        tr.method === "cash"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-sky-500/20 text-sky-300"
                      }`}
                    >
                      {tr.method}
                    </span>
                  )}
                  <span className="text-zinc-500">
                    ({formatDateTime(tr.date)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteTransfer(tr.id)}
                  className="text-zinc-500 hover:text-rose-400"
                  title="Undo settlement"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
