import type { Trip } from "@/types/trip";
import { formatDateTime } from "@/utils/currency";
import { calculateMemberBalances, simplifyDebts } from "@/utils/settleDebts";

function formatPdfRs(amount: number): string {
  const safe = Math.abs(amount) < 0.005 ? 0 : amount;
  return `Rs.${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(safe)}`;
}

function padRight(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

function escapePdfText(text: string): string {
  const ascii = text.replace(/[^\x20-\x7E]/g, " ");
  return ascii
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

interface PdfLine {
  text: string;
  bold?: boolean;
  size?: number;
  spaceAfter?: number;
}

function wrapMonoLine(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const result: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    result.push(text.slice(i, i + maxChars));
  }
  return result;
}

function buildPdfBytes(lines: PdfLine[]): Uint8Array {
  const pageHeight = 842; // A4
  const marginTop = 46;
  const marginBottom = 46;
  const marginLeft = 36;

  const expanded: PdfLine[] = [];
  for (const line of lines) {
    const size = line.size ?? 9.5;
    // Courier character width is 0.6 * fontSize; printable width ~ 523pt
    const maxChars = Math.max(48, Math.floor(523 / (size * 0.6)));
    const wrapped = wrapMonoLine(line.text, maxChars);
    wrapped.forEach((part, idx) => {
      expanded.push({
        text: part,
        bold: line.bold,
        size,
        spaceAfter: idx === wrapped.length - 1 ? line.spaceAfter ?? 5 : 3,
      });
    });
  }

  const pagesLines: PdfLine[][] = [];
  let currentPage: PdfLine[] = [];
  let y = pageHeight - marginTop;

  for (const line of expanded) {
    const size = line.size ?? 9.5;
    const step = size + (line.spaceAfter ?? 5);
    if (y - step < marginBottom && currentPage.length > 0) {
      pagesLines.push(currentPage);
      currentPage = [];
      y = pageHeight - marginTop;
    }
    currentPage.push(line);
    y -= step;
  }
  if (currentPage.length > 0) {
    pagesLines.push(currentPage);
  }

  const objects: string[] = [];
  const fontRegularId = 3;
  const fontBoldId = 4;
  const pageObjIds: number[] = [];

  objects.push("", "", "", "");

  for (const page of pagesLines) {
    const streamParts: string[] = ["BT"];
    let curY = pageHeight - marginTop;
    let lastX = 0;
    let lastY = 0;

    for (const line of page) {
      const size = line.size ?? 9.5;
      const fontRef = line.bold ? "/F2" : "/F1";
      const dx = marginLeft - lastX;
      const dy = curY - lastY;
      streamParts.push(`${fontRef} ${size} Tf`);
      streamParts.push(`${dx} ${dy} Td`);
      streamParts.push(`(${escapePdfText(line.text)}) Tj`);
      lastX = marginLeft;
      lastY = curY;
      curY -= size + (line.spaceAfter ?? 5);
    }
    streamParts.push("ET");
    const streamContent = streamParts.join("\n");

    const contentId = objects.length + 1;
    objects.push(
      `<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`
    );

    const pageId = objects.length + 1;
    pageObjIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
  }

  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageObjIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageObjIds.length} >>`;
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>";

  const chunks: string[] = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  let byteLength = chunks[0].length;

  for (let i = 0; i < objects.length; i++) {
    offsets.push(byteLength);
    const entry = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    chunks.push(entry);
    byteLength += entry.length;
  }

  const xrefStart = byteLength;
  const xrefLines: string[] = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
  ];
  for (let i = 1; i < offsets.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  xrefLines.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  );

  const fullPdf = chunks.join("") + xrefLines.join("");
  return new TextEncoder().encode(fullPdf);
}

export function downloadTripPdf(trip: Trip): void {
  const balances = calculateMemberBalances(trip);
  const settlements = simplifyDebts(balances);
  const memberById = new Map(trip.members.map((m) => [m.id, m.name]));

  const totalSpend = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
  const perHead =
    trip.members.length > 0 ? totalSpend / trip.members.length : 0;

  let upiBillsTotal = 0;
  let cashBillsTotal = 0;
  for (const exp of trip.expenses) {
    if (exp.paymentMethod === "cash") {
      cashBillsTotal += exp.amount;
    } else {
      upiBillsTotal += exp.amount;
    }
  }

  const lines: PdfLine[] = [
    {
      text: `${trip.name.toUpperCase()} - EXPENSE REPORT`,
      bold: true,
      size: 14,
      spaceAfter: 5,
    },
    {
      text: `Generated: ${new Date().toLocaleString("en-IN")}${
        trip.location ? ` | Location: ${trip.location}` : ""
      }`,
      size: 8.5,
      spaceAfter: 8,
    },
    {
      text: `Total Spend: ${formatPdfRs(totalSpend)} | Per Head: ${formatPdfRs(
        perHead
      )} | Friends: ${trip.members.length} | Bills: ${trip.expenses.length}`,
      bold: true,
      size: 9.5,
      spaceAfter: 4,
    },
    {
      text: `UPI Paid: ${formatPdfRs(upiBillsTotal)} | Cash Paid: ${formatPdfRs(
        cashBillsTotal
      )}`,
      size: 9.5,
      spaceAfter: 12,
    },
    { text: "1. MEMBER SUMMARY", bold: true, size: 11, spaceAfter: 6 },
  ];

  if (balances.length === 0) {
    lines.push({ text: "No members added yet.", size: 9, spaceAfter: 10 });
  } else {
    const rows = balances.map((b) => {
      const status =
        b.netBalance > 0.5
          ? `+${formatPdfRs(b.netBalance)} (Receive)`
          : b.netBalance < -0.5
          ? `-${formatPdfRs(Math.abs(b.netBalance))} (Pay)`
          : "Settled";
      return {
        name: b.member.name,
        paid: formatPdfRs(b.totalPaidWithAdvance),
        used: formatPdfRs(b.totalConsumed),
        status,
      };
    });

    const nameW = Math.max(4, ...rows.map((r) => r.name.length));
    const paidW = Math.max(4, ...rows.map((r) => r.paid.length));
    const usedW = Math.max(4, ...rows.map((r) => r.used.length));
    const statusW = Math.max(6, ...rows.map((r) => r.status.length));
    const divider = `${"-".repeat(nameW)}-+-${"-".repeat(paidW)}-+-${"-".repeat(
      usedW
    )}-+-${"-".repeat(statusW)}`;

    lines.push({
      text: `${padRight("Name", nameW)} | ${padLeft("Paid", paidW)} | ${padLeft(
        "Used",
        usedW
      )} | ${padRight("Status", statusW)}`,
      bold: true,
      size: 9.5,
      spaceAfter: 3,
    });
    lines.push({ text: divider, size: 9.5, spaceAfter: 4 });
    for (const r of rows) {
      lines.push({
        text: `${padRight(r.name, nameW)} | ${padLeft(
          r.paid,
          paidW
        )} | ${padLeft(r.used, usedW)} | ${padRight(r.status, statusW)}`,
        size: 9.5,
        spaceAfter: 4,
      });
    }
  }

  lines.push({ text: "", size: 6, spaceAfter: 4 });
  lines.push({
    text: "2. FINAL PAYMENT INSTRUCTIONS",
    bold: true,
    size: 11,
    spaceAfter: 6,
  });

  if (settlements.length === 0) {
    lines.push({ text: "All settled up!", size: 9.5, spaceAfter: 10 });
  } else {
    const payRows = settlements.map((s) => ({
      from: memberById.get(s.fromMemberId) ?? "Unknown",
      to: memberById.get(s.toMemberId) ?? "Unknown",
      amount: formatPdfRs(s.amount),
    }));
    const fromW = Math.max(4, ...payRows.map((r) => r.from.length));
    const toW = Math.max(2, ...payRows.map((r) => r.to.length));
    const amtW = Math.max(6, ...payRows.map((r) => r.amount.length));
    const payDivider = `${"-".repeat(fromW)}----${"-".repeat(
      toW
    )}-+-${"-".repeat(amtW)}`;

    lines.push({
      text: `${padRight("From", fromW)} -> ${padRight("To", toW)} | ${padLeft(
        "Amount",
        amtW
      )}`,
      bold: true,
      size: 9.5,
      spaceAfter: 3,
    });
    lines.push({ text: payDivider, size: 9.5, spaceAfter: 4 });
    for (const r of payRows) {
      lines.push({
        text: `${padRight(r.from, fromW)} -> ${padRight(
          r.to,
          toW
        )} | ${padLeft(r.amount, amtW)}`,
        size: 9.5,
        spaceAfter: 4,
      });
    }
  }

  lines.push({ text: "", size: 6, spaceAfter: 4 });
  lines.push({
    text: `3. EXPENSE LEDGER (${trip.expenses.length} BILLS)`,
    bold: true,
    size: 11,
    spaceAfter: 6,
  });

  const sortedExpenses = [...trip.expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (sortedExpenses.length === 0) {
    lines.push({ text: "No bills recorded.", size: 9, spaceAfter: 10 });
  } else {
    const expRows = sortedExpenses.map((exp) => ({
      when: formatDateTime(exp.date),
      title: exp.title,
      mode: (exp.paymentMethod ?? "upi").toUpperCase(),
      paidBy: exp.payers
        .map(
          (p) =>
            `${memberById.get(p.memberId) ?? "Unknown"} ${formatPdfRs(p.amount)}`
        )
        .join(" + "),
      amount: formatPdfRs(exp.amount),
      splitFor: exp.splits
        .map(
          (s) =>
            `${memberById.get(s.memberId) ?? "Unknown"} ${formatPdfRs(s.share)}`
        )
        .join(", "),
    }));

    const whenW = Math.max(9, ...expRows.map((r) => r.when.length));
    const titleW = Math.max(5, ...expRows.map((r) => r.title.length));
    const modeW = 4;
    const amtW = Math.max(6, ...expRows.map((r) => r.amount.length));
    const expDiv = `${"-".repeat(whenW)}-+-${"-".repeat(
      titleW
    )}-+-${"-".repeat(modeW)}-+-${"-".repeat(amtW)}`;

    lines.push({
      text: `${padRight("Date & Time", whenW)} | ${padRight(
        "Bill",
        titleW
      )} | ${padRight("Mode", modeW)} | ${padLeft("Amount", amtW)}`,
      bold: true,
      size: 8.5,
      spaceAfter: 3,
    });
    lines.push({ text: expDiv, size: 8.5, spaceAfter: 4 });

    for (const r of expRows) {
      lines.push({
        text: `${padRight(r.when, whenW)} | ${padRight(
          r.title,
          titleW
        )} | ${padRight(r.mode, modeW)} | ${padLeft(r.amount, amtW)}`,
        bold: true,
        size: 8.5,
        spaceAfter: 2,
      });
      lines.push({
        text: `  Paid: ${r.paidBy} | For: ${r.splitFor}`,
        size: 8,
        spaceAfter: 5,
      });
    }
  }

  if (trip.transfers.length > 0) {
    lines.push({ text: "", size: 6, spaceAfter: 4 });
    lines.push({
      text: `4. SETTLEMENTS LOG (${trip.transfers.length})`,
      bold: true,
      size: 11,
      spaceAfter: 6,
    });
    trip.transfers.forEach((tr, idx) => {
      const from = memberById.get(tr.fromMemberId) ?? "Unknown";
      const to = memberById.get(tr.toMemberId) ?? "Unknown";
      const mode = (tr.method ?? "upi").toUpperCase();
      lines.push({
        text: `${idx + 1}. [${formatDateTime(tr.date)}] ${from} -> ${to} | ${formatPdfRs(
          tr.amount
        )} [${mode}]`,
        size: 8.5,
        spaceAfter: 4,
      });
    });
  }

  const pdfBytes = buildPdfBytes(lines);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = trip.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  a.href = url;
  a.download = `${safeName || "trip"}-expense-report.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
