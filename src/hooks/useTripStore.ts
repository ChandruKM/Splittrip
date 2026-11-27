"use client";

import { useCallback, useSyncExternalStore } from "react";
import type {
  CashTransfer,
  Expense,
  ExpenseEditRecord,
  Member,
  Trip,
} from "@/types/trip";
import { formatINR } from "@/utils/currency";
import { INITIAL_TRIPS, MEMBER_COLORS } from "@/utils/seedData";

const STORAGE_KEY = "splittrip_store_v2";

interface StoreState {
  trips: Trip[];
  activeTripId: string;
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function getDefaultState(): StoreState {
  return {
    trips: INITIAL_TRIPS,
    activeTripId: INITIAL_TRIPS[0].id,
  };
}

const DEFAULT_STATE = getDefaultState();
let cachedState: StoreState | null = null;
const listeners = new Set<() => void>();

function loadFromStorage(): StoreState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  if (cachedState) return cachedState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedState = DEFAULT_STATE;
      return cachedState;
    }
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    if (!Array.isArray(parsed.trips) || parsed.trips.length === 0) {
      cachedState = DEFAULT_STATE;
      return cachedState;
    }
    const activeExists = parsed.trips.some((t) => t.id === parsed.activeTripId);
    cachedState = {
      trips: parsed.trips,
      activeTripId: activeExists ? (parsed.activeTripId as string) : parsed.trips[0].id,
    };
    return cachedState;
  } catch {
    cachedState = DEFAULT_STATE;
    return cachedState;
  }
}

function setStoreState(updater: StoreState | ((prev: StoreState) => StoreState)) {
  const prev = loadFromStorage();
  const next = typeof updater === "function" ? updater(prev) : updater;
  cachedState = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors gracefully
  }
  listeners.forEach((l) => l());
}

function subscribeStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getClientSnapshot(): StoreState {
  return loadFromStorage();
}

function getServerSnapshot(): StoreState {
  return DEFAULT_STATE;
}

function subscribeEmpty() {
  return () => {};
}

export function useTripStore() {
  const state = useSyncExternalStore(
    subscribeStore,
    getClientSnapshot,
    getServerSnapshot
  );
  const isHydrated = useSyncExternalStore(
    subscribeEmpty,
    () => true,
    () => false
  );

  const activeTrip =
    state.trips.find((t) => t.id === state.activeTripId) ?? state.trips[0];

  const updateTrip = useCallback(
    (tripId: string, updater: (trip: Trip) => Trip) => {
      setStoreState((prev) => ({
        ...prev,
        trips: prev.trips.map((t) => (t.id === tripId ? updater(t) : t)),
      }));
    },
    []
  );

  const setActiveTrip = useCallback((tripId: string) => {
    setStoreState((prev) => ({ ...prev, activeTripId: tripId }));
  }, []);

  const createTrip = useCallback((name: string, location?: string) => {
    const newTrip: Trip = {
      id: makeId("trip"),
      name: name.trim(),
      location: location?.trim() || undefined,
      createdAt: new Date().toISOString(),
      members: [],
      expenses: [],
      transfers: [],
    };
    setStoreState((prev) => ({
      trips: [newTrip, ...prev.trips],
      activeTripId: newTrip.id,
    }));
    return newTrip.id;
  }, []);

  const deleteTrip = useCallback((tripId: string) => {
    setStoreState((prev) => {
      const remaining = prev.trips.filter((t) => t.id !== tripId);
      if (remaining.length === 0) {
        const freshTrip: Trip = {
          id: makeId("trip"),
          name: "My Trip",
          createdAt: new Date().toISOString(),
          members: [],
          expenses: [],
          transfers: [],
        };
        return { trips: [freshTrip], activeTripId: freshTrip.id };
      }
      const nextActive =
        prev.activeTripId === tripId ? remaining[0].id : prev.activeTripId;
      return { trips: remaining, activeTripId: nextActive };
    });
  }, []);

  const updateTripDetails = useCallback(
    (tripId: string, name: string, location?: string) => {
      if (!name.trim()) return;
      updateTrip(tripId, (trip) => ({
        ...trip,
        name: name.trim(),
        location: location?.trim() || undefined,
      }));
    },
    [updateTrip]
  );

  const addMember = useCallback(
    (tripId: string, name: string, initialAdvance = 0) => {
      updateTrip(tripId, (trip) => {
        const color =
          MEMBER_COLORS[trip.members.length % MEMBER_COLORS.length];
        const newMember: Member = {
          id: makeId("m"),
          name: name.trim(),
          color,
          initialAdvance: Math.max(0, Number(initialAdvance) || 0),
        };
        return { ...trip, members: [...trip.members, newMember] };
      });
    },
    [updateTrip]
  );

  const updateMember = useCallback(
    (
      tripId: string,
      memberId: string,
      updates: { name?: string; initialAdvance?: number }
    ) => {
      updateTrip(tripId, (trip) => ({
        ...trip,
        members: trip.members.map((m) =>
          m.id === memberId
            ? {
                ...m,
                name: updates.name !== undefined ? updates.name.trim() : m.name,
                initialAdvance:
                  updates.initialAdvance !== undefined
                    ? Math.max(0, Number(updates.initialAdvance) || 0)
                    : m.initialAdvance,
              }
            : m
        ),
      }));
    },
    [updateTrip]
  );

  const removeMember = useCallback(
    (tripId: string, memberId: string): boolean => {
      const target = state.trips.find((t) => t.id === tripId);
      if (!target) return false;
      const usedInExpense = target.expenses.some(
        (e) =>
          e.payers.some((p) => p.memberId === memberId) ||
          e.splits.some((s) => s.memberId === memberId)
      );
      const usedInTransfer = target.transfers.some(
        (tr) => tr.fromMemberId === memberId || tr.toMemberId === memberId
      );
      if (usedInExpense || usedInTransfer) return false;

      updateTrip(tripId, (trip) => ({
        ...trip,
        members: trip.members.filter((m) => m.id !== memberId),
      }));
      return true;
    },
    [state.trips, updateTrip]
  );

  const addExpense = useCallback(
    (tripId: string, expense: Omit<Expense, "id">) => {
      const newExpense: Expense = { ...expense, id: makeId("exp") };
      updateTrip(tripId, (trip) => ({
        ...trip,
        expenses: [newExpense, ...trip.expenses],
      }));
    },
    [updateTrip]
  );

  const updateExpense = useCallback(
    (tripId: string, expenseId: string, expense: Omit<Expense, "id">) => {
      updateTrip(tripId, (trip) => {
        const memberName = new Map(trip.members.map((m) => [m.id, m.name]));
        const formatPayers = (list: Expense["payers"]) =>
          list
            .map((p) => `${memberName.get(p.memberId) ?? "?"} ${formatINR(p.amount)}`)
            .join(" + ");
        const formatSplits = (list: Expense["splits"]) =>
          list
            .map((s) => `${memberName.get(s.memberId) ?? "?"} ${formatINR(s.share)}`)
            .join(", ");

        return {
          ...trip,
          expenses: trip.expenses.map((prevExp) => {
            if (prevExp.id !== expenseId) return prevExp;

            const changes: string[] = [];
            if (prevExp.title !== expense.title) {
              changes.push(`Title: "${prevExp.title}" → "${expense.title}"`);
            }
            if (Math.abs(prevExp.amount - expense.amount) > 0.01) {
              changes.push(
                `Amount: ${formatINR(prevExp.amount)} → ${formatINR(expense.amount)}`
              );
            }
            const oldMode = (prevExp.paymentMethod ?? "upi").toUpperCase();
            const newMode = (expense.paymentMethod ?? "upi").toUpperCase();
            if (oldMode !== newMode) {
              changes.push(`Mode: ${oldMode} → ${newMode}`);
            }
            const oldPayersStr = formatPayers(prevExp.payers);
            const newPayersStr = formatPayers(expense.payers);
            if (oldPayersStr !== newPayersStr) {
              changes.push(`Paid by: ${oldPayersStr} → ${newPayersStr}`);
            }
            const oldSplitsStr = formatSplits(prevExp.splits);
            const newSplitsStr = formatSplits(expense.splits);
            if (
              prevExp.splitMode !== expense.splitMode ||
              oldSplitsStr !== newSplitsStr
            ) {
              changes.push(
                `Split (${expense.splitMode}): ${oldSplitsStr} → ${newSplitsStr}`
              );
            }
            if (prevExp.date !== expense.date) {
              changes.push("Bill date/time updated");
            }
            if ((prevExp.notes ?? "") !== (expense.notes ?? "")) {
              changes.push(
                expense.notes ? `Note: "${expense.notes}"` : "Note removed"
              );
            }

            const nextHistory: ExpenseEditRecord[] =
              changes.length > 0
                ? [
                    { editedAt: new Date().toISOString(), changes },
                    ...(prevExp.editHistory ?? []),
                  ]
                : prevExp.editHistory ?? [];

            return {
              ...expense,
              id: expenseId,
              editHistory: nextHistory,
            };
          }),
        };
      });
    },
    [updateTrip]
  );

  const deleteExpense = useCallback(
    (tripId: string, expenseId: string) => {
      updateTrip(tripId, (trip) => ({
        ...trip,
        expenses: trip.expenses.filter((e) => e.id !== expenseId),
      }));
    },
    [updateTrip]
  );

  const addTransfer = useCallback(
    (tripId: string, transfer: Omit<CashTransfer, "id">) => {
      const newTransfer: CashTransfer = { ...transfer, id: makeId("tr") };
      updateTrip(tripId, (trip) => ({
        ...trip,
        transfers: [newTransfer, ...trip.transfers],
      }));
    },
    [updateTrip]
  );

  const deleteTransfer = useCallback(
    (tripId: string, transferId: string) => {
      updateTrip(tripId, (trip) => ({
        ...trip,
        transfers: trip.transfers.filter((tr) => tr.id !== transferId),
      }));
    },
    [updateTrip]
  );

  const exportJson = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const importJson = useCallback(
    (raw: string): { ok: boolean; error?: string } => {
      try {
        const parsed = JSON.parse(raw) as Partial<StoreState>;
        if (!Array.isArray(parsed.trips) || parsed.trips.length === 0) {
          return { ok: false, error: "Invalid backup file: no trips found." };
        }
        const valid = parsed.trips.every(
          (t) =>
            typeof t.id === "string" &&
            typeof t.name === "string" &&
            Array.isArray(t.members) &&
            Array.isArray(t.expenses) &&
            Array.isArray(t.transfers)
        );
        if (!valid) {
          return { ok: false, error: "Backup file format is corrupted." };
        }
        const activeId = parsed.trips.some((t) => t.id === parsed.activeTripId)
          ? (parsed.activeTripId as string)
          : parsed.trips[0].id;
        setStoreState({ trips: parsed.trips, activeTripId: activeId });
        return { ok: true };
      } catch {
        return { ok: false, error: "Could not parse JSON backup." };
      }
    },
    []
  );

  const resetToSampleData = useCallback(() => {
    setStoreState(getDefaultState());
  }, []);

  return {
    isHydrated,
    trips: state.trips,
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
    exportJson,
    importJson,
    resetToSampleData,
  };
}
