"use client";

import { useMemo, useState } from "react";
import { History, Receipt } from "lucide-react";
import type { Expense, Trip } from "@/types/trip";
import {
  formatDateTime,
  formatINR,
  formatShortDate,
  formatTimeOnly,
} from "@/utils/currency";

interface ExpensesTabProps {
  trips: Trip[];
  activeTrip: Trip;
  onSelectTrip: (tripId: string) => void;
  onEditBill: (expense: Expense) => void;
}

export function ExpensesTab({
  trips,
  activeTrip,
  onSelectTrip,
  onEditBill,
}: ExpensesTabProps) {
  const [filterMode, setFilterMode] = useState<"all" | "upi" | "cash">("all");

  const memberById = useMemo(
    () => new Map(activeTrip.members.map((m) => [m.id, m])),
    [activeTrip.members]
  );

  const totalSpend = activeTrip.expenses.reduce((sum, e) => sum + e.amount, 0);
  const perHead =
    activeTrip.members.length > 0 ? totalSpend / activeTrip.members.length : 0;

  let upiTotal = 0;
  let cashTotal = 0;
  for (const exp of activeTrip.expenses) {
    if (exp.paymentMethod === "cash") {
      cashTotal += exp.amount;
    } else {
      upiTotal += exp.amount;
    }
  }

  const filteredExpenses = useMemo(() => {
    return [...activeTrip.expenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter((exp) => {
        if (filterMode === "upi" && (exp.paymentMethod ?? "upi") !== "upi") {
          return false;
        }
        if (filterMode === "cash" && exp.paymentMethod !== "cash") {
          return false;
        }
        return true;
      });
  }, [activeTrip.expenses, filterMode]);

  const groupedByDate = useMemo(() => {
    const groups: {
      dateKey: string;
      label: string;
      dayTotal: number;
      items: Expense[];
    }[] = [];
    const map = new Map<string, number>();

    for (const exp of filteredExpenses) {
      const d = new Date(exp.date);
      const dateKey = Number.isNaN(d.getTime())
        ? exp.date
        : d.toLocaleDateString("en-CA");
      const label = formatShortDate(exp.date);
      const existingIdx = map.get(dateKey);
      if (existingIdx === undefined) {
        map.set(dateKey, groups.length);
        groups.push({
          dateKey,
          label,
          dayTotal: exp.amount,
          items: [exp],
        });
      } else {
        groups[existingIdx].dayTotal += exp.amount;
        groups[existingIdx].items.push(exp);
      }
    }
    return groups;
  }, [filteredExpenses]);

  return (
    <div className="space-y-4 pb-24">
      {/* Trip Switcher */}
      {trips.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {trips.map((t) => {
            const isActive = t.id === activeTrip.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTrip(t.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white"
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Midnight Glass Overview Card */}
      <div className="space-y-3 rounded-3xl border border-white/10 bg-gradient-to-br from-[#141b2d] to-[#0f1523] p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300/80">
              Total Trip Spend
            </p>
            <p className="mt-1 bg-gradient-to-b from-white to-zinc-300 bg-clip-text text-4xl font-black tracking-tight text-transparent tabular-nums">
              {formatINR(totalSpend)}
            </p>
          </div>
          <span className="rounded-full border border-blue-400/30 bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-300">
            {activeTrip.members.length} friends
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Per Head
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-blue-300 tabular-nums">
              {formatINR(perHead)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              UPI Paid
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-sky-300 tabular-nums">
              {formatINR(upiTotal)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Cash Paid
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-emerald-300 tabular-nums">
              {formatINR(cashTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* Grouped Expense History with Date & Time */}
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              History ({filteredExpenses.length})
            </h2>
            <span className="text-[11px] text-zinc-500">Tap a row to edit</span>
          </div>

          {activeTrip.expenses.length > 0 && (
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
              {(["all", "upi", "cash"] as const).map((key) => {
                const active = filterMode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterMode(key)}
                    className={`rounded-full px-4 py-1 text-[11px] font-bold transition ${
                      active
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {key === "all" ? "All" : key === "upi" ? "UPI" : "Cash"}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center">
            <Receipt className="mb-3 h-8 w-8 text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-200">
              {activeTrip.expenses.length === 0
                ? "No bills yet"
                : "No matching bills"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {activeTrip.members.length === 0
                ? "Go to the Trips tab above to add your trip friends first."
                : activeTrip.expenses.length === 0
                ? "Tap + Add Bill to log your first expense."
                : "Try selecting another filter."}
            </p>
          </div>
        ) : (
          groupedByDate.map((group) => (
            <div key={group.dateKey} className="space-y-1.5">
              <div className="flex items-center justify-between px-1.5 text-[11px] font-bold text-zinc-400">
                <span>{group.label}</span>
                <span className="tabular-nums">{formatINR(group.dayTotal)}</span>
              </div>

              <div className="divide-y divide-white/[0.06] overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111625]/90 shadow-lg">
                {group.items.map((expense) => {
                  const method = expense.paymentMethod ?? "upi";
                  const payerSummary = expense.payers
                    .map((p) => {
                      const name = memberById.get(p.memberId)?.name ?? "Unknown";
                      return expense.payers.length > 1
                        ? `${name} ${formatINR(p.amount)}`
                        : name;
                    })
                    .join(" + ");

                  const splitNames = expense.splits
                    .map((s) => memberById.get(s.memberId)?.name ?? "Unknown")
                    .join(", ");

                  return (
                    <button
                      key={expense.id}
                      type="button"
                      onClick={() => onEditBill(expense)}
                      className="flex w-full items-start justify-between gap-3 p-4 text-left transition hover:bg-white/[0.04] active:bg-white/[0.06]"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-blue-300">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">
                            {expense.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span
                              className={`rounded-md px-2 py-0.5 font-semibold ${
                                expense.payers.length > 1
                                  ? "bg-blue-500/20 text-blue-200"
                                  : "bg-white/[0.08] text-zinc-300"
                              }`}
                            >
                              Paid: {payerSummary}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 font-bold uppercase ${
                                method === "cash"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-sky-500/20 text-sky-300"
                              }`}
                            >
                              {method}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[11px] text-zinc-400">
                            For: {splitNames}
                          </p>
                          {expense.notes && (
                            <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                              {expense.notes}
                            </p>
                          )}
                          {expense.editHistory && expense.editHistory.length > 0 && (
                            <div className="mt-1.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-200">
                              <div className="flex items-center gap-1 font-bold">
                                <History className="h-3 w-3 shrink-0 text-amber-300" />
                                <span>
                                  Edited {formatDateTime(expense.editHistory[0].editedAt)}
                                </span>
                                {expense.editHistory.length > 1 && (
                                  <span className="text-amber-300">
                                    (+{expense.editHistory.length - 1} earlier)
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-amber-100/80">
                                {expense.editHistory[0].changes.join(" · ")}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-base font-extrabold text-white tabular-nums">
                          {formatINR(expense.amount)}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-zinc-400">
                          {formatShortDate(expense.date)},{" "}
                          {formatTimeOnly(expense.date)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
