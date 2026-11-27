"use client";

import { useState } from "react";
import {
  FolderKanban,
  Plus,
  Receipt,
  Scale,
} from "lucide-react";
import type { Expense } from "@/types/trip";
import { useTripStore } from "@/hooks/useTripStore";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ExpensesTab } from "@/components/ExpensesTab";
import { SettleUpTab } from "@/components/SettleUpTab";
import { TripsBackupTab } from "@/components/TripsBackupTab";
import { ExpenseModal } from "@/components/ExpenseModal";
import { WelcomeSplash } from "@/components/WelcomeSplash";

type TabId = "expenses" | "settle" | "trips";

const TABS: { id: TabId; label: string; Icon: typeof Receipt }[] = [
  { id: "expenses", label: "Bills", Icon: Receipt },
  { id: "settle", label: "Settle Up", Icon: Scale },
  { id: "trips", label: "Trips", Icon: FolderKanban },
];

export default function HomePage() {
  const {
    isHydrated,
    trips,
    activeTrip,
    setActiveTrip,
    createTrip,
    deleteTrip,
    updateTripDetails,
    addMember,
    updateMember,
    removeMember,
    addExpense,
    updateExpense,
    deleteExpense,
    addTransfer,
    deleteTransfer,
  } = useTripStore();

  const [activeTab, setActiveTab] = useState<TabId>("expenses");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col text-zinc-100">
      <WelcomeSplash trip={activeTrip} isHydrated={isHydrated} />

      {/* Sticky Midnight Glass Header + Segmented Navigation */}
      <header className="sticky top-0 z-30 border-b border-white/[0.10] bg-[#05070d]/85 px-4 pb-3 pt-safe backdrop-blur-xl">
        <div className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 text-sm font-black text-white shadow-lg shadow-blue-600/25">
              ₹
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white">
                SplitTrip
              </h1>
              <p className="text-[11px] font-semibold text-blue-300/90">
                {activeTrip.name}
              </p>
            </div>
          </div>
          <ServiceWorkerRegister />
        </div>

        {/* Top Segmented Pill Tabs */}
        <nav
          aria-label="Primary"
          className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1"
        >
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold transition ${
                  active
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-safe pt-4">
        {activeTab === "expenses" && (
          <ExpensesTab
            trips={trips}
            activeTrip={activeTrip}
            onSelectTrip={setActiveTrip}
            onEditBill={(exp) => {
              setEditingExpense(exp);
              setIsModalOpen(true);
            }}
          />
        )}

        {activeTab === "settle" && (
          <SettleUpTab
            trip={activeTrip}
            onMarkSettled={(transfer) => addTransfer(activeTrip.id, transfer)}
            onDeleteTransfer={(transferId) =>
              deleteTransfer(activeTrip.id, transferId)
            }
          />
        )}

        {activeTab === "trips" && (
          <TripsBackupTab
            trips={trips}
            activeTrip={activeTrip}
            onSelectTrip={setActiveTrip}
            onCreateTrip={createTrip}
            onUpdateTrip={updateTripDetails}
            onDeleteTrip={deleteTrip}
            onAddMember={addMember}
            onUpdateMember={updateMember}
            onRemoveMember={removeMember}
          />
        )}
      </main>

      {/* Floating Glowing Action Pill (Bills & Settle Up tabs) */}
      {activeTrip.members.length > 0 && activeTab !== "trips" && (
        <div className="pointer-events-none fixed bottom-5 left-0 right-0 z-40 mx-auto flex max-w-xl justify-end px-4 pb-safe">
          <button
            type="button"
            onClick={() => {
              setEditingExpense(null);
              setIsModalOpen(true);
            }}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-600/30 transition hover:brightness-110 active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            Add Bill
          </button>
        </div>
      )}

      {/* Add / Edit Bill Modal */}
      <ExpenseModal
        isOpen={isModalOpen}
        members={activeTrip.members}
        initialExpense={editingExpense}
        onClose={() => {
          setIsModalOpen(false);
          setEditingExpense(null);
        }}
        onSave={(data) => {
          if (editingExpense) {
            updateExpense(activeTrip.id, editingExpense.id, data);
          } else {
            addExpense(activeTrip.id, data);
          }
        }}
        onDelete={(expenseId) => deleteExpense(activeTrip.id, expenseId)}
      />
    </div>
  );
}
