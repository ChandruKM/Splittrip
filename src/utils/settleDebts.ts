import type {
  MemberBalance,
  SimplifiedTransfer,
  Trip,
} from "@/types/trip";
import { formatINR, round2 } from "@/utils/currency";

/**
 * Calculates each member's detailed balance breakdown:
 * Net Balance = (Initial Advance + Total Bills Paid + Transfers Given)
 *             - (Total Share Consumed + Transfers Received)
 *
 * Positive netBalance => Need to Receive
 * Negative netBalance => Need to Pay
 */
export function calculateMemberBalances(trip: Trip): MemberBalance[] {
  const billsPaidMap = new Map<string, number>();
  const consumedMap = new Map<string, number>();
  const transfersGivenMap = new Map<string, number>();
  const transfersReceivedMap = new Map<string, number>();

  for (const m of trip.members) {
    billsPaidMap.set(m.id, 0);
    consumedMap.set(m.id, 0);
    transfersGivenMap.set(m.id, 0);
    transfersReceivedMap.set(m.id, 0);
  }

  for (const expense of trip.expenses) {
    for (const payer of expense.payers) {
      billsPaidMap.set(
        payer.memberId,
        (billsPaidMap.get(payer.memberId) ?? 0) + payer.amount
      );
    }
    for (const split of expense.splits) {
      consumedMap.set(
        split.memberId,
        (consumedMap.get(split.memberId) ?? 0) + split.share
      );
    }
  }

  for (const transfer of trip.transfers) {
    transfersGivenMap.set(
      transfer.fromMemberId,
      (transfersGivenMap.get(transfer.fromMemberId) ?? 0) + transfer.amount
    );
    transfersReceivedMap.set(
      transfer.toMemberId,
      (transfersReceivedMap.get(transfer.toMemberId) ?? 0) + transfer.amount
    );
  }

  return trip.members.map((member) => {
    const initialAdvance = round2(member.initialAdvance || 0);
    const totalBillsPaid = round2(billsPaidMap.get(member.id) ?? 0);
    const transfersGiven = round2(transfersGivenMap.get(member.id) ?? 0);
    const transfersReceived = round2(transfersReceivedMap.get(member.id) ?? 0);
    const totalConsumed = round2(consumedMap.get(member.id) ?? 0);

    const netBalance = round2(
      initialAdvance +
        totalBillsPaid +
        transfersGiven -
        (totalConsumed + transfersReceived)
    );

    return {
      member,
      initialAdvance,
      totalBillsPaid,
      transfersGiven,
      transfersReceived,
      totalPaidWithAdvance: round2(initialAdvance + totalBillsPaid),
      totalConsumed,
      netBalance,
    };
  });
}

/**
 * Simplifies all debts into the minimum number of final transfers
 * using a greedy largest-debtor / largest-creditor matching algorithm.
 */
export function simplifyDebts(balances: MemberBalance[]): SimplifiedTransfer[] {
  const EPSILON = 0.5;

  const debtors = balances
    .filter((b) => b.netBalance < -EPSILON)
    .map((b) => ({ memberId: b.member.id, amount: Math.abs(b.netBalance) }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((b) => b.netBalance > EPSILON)
    .map((b) => ({ memberId: b.member.id, amount: b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: SimplifiedTransfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settleAmount = round2(Math.min(debtor.amount, creditor.amount));

    if (settleAmount >= EPSILON) {
      settlements.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount: Math.round(settleAmount * 100) / 100,
      });
    }

    debtor.amount = round2(debtor.amount - settleAmount);
    creditor.amount = round2(creditor.amount - settleAmount);

    if (debtor.amount < EPSILON) i++;
    if (creditor.amount < EPSILON) j++;
  }

  return settlements;
}

function padRight(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

export function buildWhatsAppSummary(
  trip: Trip,
  balances: MemberBalance[],
  settlements: SimplifiedTransfer[]
): string {
  const totalSpend = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
  const perHead =
    trip.members.length > 0 ? totalSpend / trip.members.length : 0;
  const memberById = new Map(trip.members.map((m) => [m.id, m.name]));

  const rows = balances.map((b) => {
    const status =
      b.netBalance > 0.5
        ? `+${formatINR(b.netBalance)} (Receive)`
        : b.netBalance < -0.5
        ? `-${formatINR(Math.abs(b.netBalance))} (Pay)`
        : "Settled ✓";
    return {
      name: b.member.name,
      paid: formatINR(b.totalPaidWithAdvance),
      used: formatINR(b.totalConsumed),
      status,
    };
  });

  const nameW = Math.max(4, ...rows.map((r) => r.name.length));
  const paidW = Math.max(4, ...rows.map((r) => r.paid.length));
  const usedW = Math.max(4, ...rows.map((r) => r.used.length));
  const statusW = Math.max(6, ...rows.map((r) => r.status.length));

  const divider = `${"-".repeat(nameW)}-+-${"-".repeat(paidW)}-+-${"-".repeat(usedW)}-+-${"-".repeat(statusW)}`;

  const lines: string[] = [
    `*${trip.name.toUpperCase()} — EXPENSE REPORT*`,
    `Total Spend: *${formatINR(totalSpend)}*  |  Per Head: *${formatINR(perHead)}*  |  Friends: *${trip.members.length}*`,
    "",
    "*1. MEMBER SUMMARY*",
    "```",
    `${padRight("Name", nameW)} | ${padLeft("Paid", paidW)} | ${padLeft("Used", usedW)} | ${padRight("Status", statusW)}`,
    divider,
    ...rows.map(
      (r) =>
        `${padRight(r.name, nameW)} | ${padLeft(r.paid, paidW)} | ${padLeft(r.used, usedW)} | ${padRight(r.status, statusW)}`
    ),
    "```",
  ];

  lines.push("");
  if (settlements.length === 0) {
    lines.push("*2. FINAL PAYMENT INSTRUCTIONS*");
    lines.push("All settled up! ✓");
  } else {
    const payRows = settlements.map((s) => ({
      from: memberById.get(s.fromMemberId) ?? "Unknown",
      to: memberById.get(s.toMemberId) ?? "Unknown",
      amount: formatINR(s.amount),
    }));
    const fromW = Math.max(4, ...payRows.map((r) => r.from.length));
    const toW = Math.max(2, ...payRows.map((r) => r.to.length));
    const amtW = Math.max(6, ...payRows.map((r) => r.amount.length));
    const payDivider = `${"-".repeat(fromW)}----${"-".repeat(toW)}-+-${"-".repeat(amtW)}`;

    lines.push("*2. FINAL PAYMENT INSTRUCTIONS*");
    lines.push("```");
    lines.push(
      `${padRight("From", fromW)} -> ${padRight("To", toW)} | ${padLeft("Amount", amtW)}`
    );
    lines.push(payDivider);
    for (const r of payRows) {
      lines.push(
        `${padRight(r.from, fromW)} -> ${padRight(r.to, toW)} | ${padLeft(r.amount, amtW)}`
      );
    }
    lines.push("```");
  }

  return lines.join("\n");
}
