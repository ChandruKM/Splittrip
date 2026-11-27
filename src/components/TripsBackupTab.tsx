"use client";

import { useState } from "react";
import {
  Check,
  FileDown,
  MapPin,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { Trip } from "@/types/trip";
import { generateTripPdf } from "@/utils/generateTripPdf";
import { calculateMemberBalances, simplifyDebts } from "@/utils/settleDebts";
import { MemberAvatar } from "@/components/MemberAvatar";

interface TripsBackupTabProps {
  trips: Trip[];
  activeTrip: Trip;
  onSelectTrip: (tripId: string) => void;
  onCreateTrip: (name: string, location?: string) => void;
  onUpdateTrip: (tripId: string, name: string, location?: string) => void;
  onDeleteTrip: (tripId: string) => void;
  onAddMember: (tripId: string, name: string, initialAdvance: number) => void;
  onUpdateMember: (
    tripId: string,
    memberId: string,
    updates: { name?: string; initialAdvance?: number }
  ) => void;
  onRemoveMember: (tripId: string, memberId: string) => boolean;
}

export function TripsBackupTab({
  trips,
  activeTrip,
  onSelectTrip,
  onCreateTrip,
  onUpdateTrip,
  onDeleteTrip,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
}: TripsBackupTabProps) {
  const [showNewTripForm, setShowNewTripForm] = useState(false);
  const [tripName, setTripName] = useState("");
  const [tripLocation, setTripLocation] = useState("");

  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [editTripName, setEditTripName] = useState("");
  const [editTripLocation, setEditTripLocation] = useState("");

  const [memberInput, setMemberInput] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberName, setEditMemberName] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState(false);
  const [pdfSaved, setPdfSaved] = useState(false);

  const activeSettlements = simplifyDebts(calculateMemberBalances(activeTrip));

  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripName.trim()) return;
    onCreateTrip(tripName, tripLocation);
    setTripName("");
    setTripLocation("");
    setShowNewTripForm(false);
  };

  const handleSaveTripEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTripName.trim()) return;
    onUpdateTrip(activeTrip.id, editTripName, editTripLocation);
    setIsEditingTrip(false);
  };

  const handleAddMembers = (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);
    const names = memberInput
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) {
      setMemberError("Enter at least one friend's name.");
      return;
    }
    for (const name of names) {
      onAddMember(activeTrip.id, name, 0);
    }
    setMemberInput("");
  };

  const handleDownloadPdf = () => {
    generateTripPdf(activeTrip);
    setPdfSaved(true);
    setTimeout(() => setPdfSaved(false), 2500);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Active Trip Card (Zero Amounts) */}
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#141b2d] to-[#0f1523] p-5 text-white shadow-xl">
        {isEditingTrip ? (
          <form onSubmit={handleSaveTripEdit} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Edit Trip Details
              </span>
              <button
                type="button"
                onClick={() => setIsEditingTrip(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={editTripName}
              onChange={(e) => setEditTripName(e.target.value)}
              placeholder="Trip name"
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-bold text-white placeholder-zinc-500 focus:border-blue-400 focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={editTripLocation}
                onChange={(e) => setEditTripLocation(e.target.value)}
                placeholder="Location (optional)"
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-blue-400 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-500"
              >
                <Check className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      activeSettlements.length === 0
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {activeSettlements.length === 0
                      ? "All Settled ✓"
                      : `${activeSettlements.length} Pending`}
                  </span>
                  {activeTrip.location && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                      <MapPin className="h-3 w-3 text-blue-400" />
                      {activeTrip.location}
                    </span>
                  )}
                </div>
                <h2 className="mt-1.5 bg-gradient-to-b from-white to-zinc-300 bg-clip-text text-2xl font-black tracking-tight text-transparent">
                  {activeTrip.name}
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditTripName(activeTrip.name);
                    setEditTripLocation(activeTrip.location ?? "");
                    setIsEditingTrip(true);
                    setConfirmDeleteTrip(false);
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.06] p-2 text-zinc-300 transition hover:bg-white/15 hover:text-white"
                  title="Edit trip"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteTrip((prev) => !prev)}
                  className={`rounded-xl border p-2 transition ${
                    confirmDeleteTrip
                      ? "border-rose-400/50 bg-rose-500/20 text-rose-300"
                      : "border-white/10 bg-white/[0.06] text-zinc-400 hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-rose-300"
                  }`}
                  title="Delete trip"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {confirmDeleteTrip && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/15 px-3.5 py-2.5">
                <p className="text-xs font-semibold text-rose-200">
                  Delete &ldquo;{activeTrip.name}&rdquo;?
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteTrip(false)}
                    className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-zinc-200 hover:bg-white/20"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteTrip(activeTrip.id);
                      setConfirmDeleteTrip(false);
                    }}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Friends
                  </p>
                  <p className="text-sm font-extrabold text-white tabular-nums">
                    {activeTrip.members.length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                  <Receipt className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Bills
                  </p>
                  <p className="text-sm font-extrabold text-white tabular-nums">
                    {activeTrip.expenses.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-500 active:scale-[0.99]"
              >
                <FileDown className="h-4 w-4" />
                {pdfSaved ? "PDF Saved ✓" : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={() => setShowNewTripForm((prev) => !prev)}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-xs font-bold text-zinc-100 transition hover:bg-white/15 active:scale-[0.99]"
              >
                {showNewTripForm ? (
                  <>
                    <X className="h-4 w-4" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    New Trip
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </section>

      {/* Expandable Create New Trip Form */}
      {showNewTripForm && (
        <form
          onSubmit={handleCreateTrip}
          className="space-y-2.5 rounded-3xl border border-blue-400/30 bg-[#111625] p-4 shadow-lg"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-blue-300">
            Create New Trip
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Trip name (e.g. Goa 2026)"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              autoFocus
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-semibold text-white placeholder-zinc-500 focus:border-blue-400 focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-500"
            >
              <Plus className="h-3.5 w-3.5" />
              Create
            </button>
          </div>
          <input
            type="text"
            placeholder="Location (optional)"
            value={tripLocation}
            onChange={(e) => setTripLocation(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-blue-400 focus:outline-none"
          />
        </form>
      )}

      {/* Trip Switcher */}
      {trips.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {trips.map((t) => {
            const isActive = t.id === activeTrip.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSelectTrip(t.id);
                  setIsEditingTrip(false);
                  setConfirmDeleteTrip(false);
                }}
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

      {/* 2. Friends Management Card */}
      <section className="space-y-3 rounded-3xl border border-white/[0.08] bg-[#111625]/90 p-4 shadow-lg">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            Friends ({activeTrip.members.length})
          </h2>
          <span className="text-[10px] font-medium text-zinc-500">
            Separate names with commas
          </span>
        </div>

        <form onSubmit={handleAddMembers} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Sanjai, Pradeep, Arul"
            value={memberInput}
            onChange={(e) => setMemberInput(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-xs font-medium text-white placeholder-zinc-500 focus:border-blue-400 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-blue-500"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add
          </button>
        </form>

        {memberError && (
          <p className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-300">
            {memberError}
          </p>
        )}

        {activeTrip.members.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center text-xs text-zinc-500">
            Add your trip friends above (you can add multiple at once with commas).
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {activeTrip.members.map((m) => {
              const isEditing = editingMemberId === m.id;

              return (
                <div
                  key={m.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 transition hover:border-white/15"
                >
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editMemberName}
                        onChange={(e) => setEditMemberName(e.target.value)}
                        autoFocus
                        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-blue-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (editMemberName.trim()) {
                            onUpdateMember(activeTrip.id, m.id, {
                              name: editMemberName,
                            });
                          }
                          setEditingMemberId(null);
                        }}
                        className="rounded-lg bg-blue-600 p-1.5 text-white"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <MemberAvatar member={m} size="sm" />
                        <p className="truncate text-xs font-bold text-white">
                          {m.name}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMemberId(m.id);
                            setEditMemberName(m.name);
                            setMemberError(null);
                          }}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
                          title="Edit friend"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const ok = onRemoveMember(activeTrip.id, m.id);
                            if (!ok) {
                              setMemberError(
                                `${m.name} is linked to existing bills or settlements.`
                              );
                            }
                          }}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-300"
                          title="Remove friend"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
