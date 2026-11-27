import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Trip } from "@/types/trip";
import { calculateMemberBalances, simplifyDebts } from "@/utils/settleDebts";

const GRID_BORDER_COLOR: [number, number, number] = [190, 200, 212];
const NAVY_HEADER_FILL: [number, number, number] = [30, 41, 82];
const EMERALD_HEADER_FILL: [number, number, number] = [16, 95, 75];
const FOOTER_FILL: [number, number, number] = [241, 245, 249];

function formatPdfRs(amount: number): string {
  const safe = Math.abs(amount) < 0.005 ? 0 : amount;
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(safe)}`;
}

function formatPdfDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
  const timePart = d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart}, ${timePart.toUpperCase()}`;
}

function drawSectionBanner(
  doc: jsPDF,
  title: string,
  y: number,
  fillColor: [number, number, number] = NAVY_HEADER_FILL
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const boxWidth = pageWidth - marginX * 2;
  const boxHeight = 7.5;

  if (y + boxHeight + 18 > doc.internal.pageSize.getHeight() - 18) {
    doc.addPage();
    y = 14;
  }

  doc.setFillColor(...fillColor);
  doc.setDrawColor(...GRID_BORDER_COLOR);
  doc.setLineWidth(0.25);
  doc.rect(marginX, y, boxWidth, boxHeight, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(title, marginX + 3, y + 5.2);

  return y + boxHeight;
}

function getLastAutoTableY(doc: jsPDF, fallback: number): number {
  const docWithTable = doc as jsPDF & {
    lastAutoTable?: { finalY?: number };
  };
  return docWithTable.lastAutoTable?.finalY ?? fallback;
}

export function generateTripPdf(trip: Trip): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  const balances = calculateMemberBalances(trip);
  const settlements = simplifyDebts(balances);
  const memberById = new Map(trip.members.map((m) => [m.id, m.name]));

  const totalSpend = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
  const perHead =
    trip.members.length > 0 ? totalSpend / trip.members.length : 0;

  // Header Banner
  const bannerY = 12;
  const bannerH = 12;
  doc.setFillColor(...NAVY_HEADER_FILL);
  doc.rect(marginX, bannerY, contentWidth, bannerH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`${trip.name.toUpperCase()} - TRIP SUMMARY`, marginX + 3.5, bannerY + 7.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    formatPdfDateTime(new Date().toISOString()),
    pageWidth - marginX - 3.5,
    bannerY + 7.5,
    { align: "right" }
  );

  // Compact 1-Row Overview Grid
  autoTable(doc, {
    startY: bannerY + bannerH,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 3,
      lineWidth: 0.25,
      lineColor: GRID_BORDER_COLOR,
      textColor: [30, 41, 59],
      valign: "middle",
    },
    body: [
      [
        `Total Spend: ${formatPdfRs(totalSpend)}`,
        `Per Head: ${formatPdfRs(perHead)}`,
        `Friends: ${trip.members.length}`,
        `Bills: ${trip.expenses.length}`,
      ],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: contentWidth * 0.30 },
      1: { fontStyle: "bold", cellWidth: contentWidth * 0.28 },
      2: { cellWidth: contentWidth * 0.21 },
      3: { cellWidth: contentWidth * 0.21 },
    },
  });

  let cursorY = getLastAutoTableY(doc, bannerY + bannerH + 10) + 6;

  // 1. Bills List (Oldest to Newest)
  cursorY = drawSectionBanner(doc, "1. BILLS LIST", cursorY);

  const sortedBills = [...trip.expenses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const billsBody =
    sortedBills.length > 0
      ? sortedBills.map((exp, idx) => {
          const mode = (exp.paymentMethod ?? "upi").toUpperCase();
          const paidBy = exp.payers
            .map(
              (p) =>
                `${memberById.get(p.memberId) ?? "Unknown"} (${formatPdfRs(p.amount)})`
            )
            .join(" + ");
          return [
            String(idx + 1),
            formatPdfDateTime(exp.date),
            exp.title,
            `${paidBy} [${mode}]`,
            formatPdfRs(exp.amount),
          ];
        })
      : [["-", "-", "No bills recorded", "-", formatPdfRs(0)]];

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    head: [["#", "Date & Time", "Bill", "Paid By", "Amount"]],
    body: billsBody,
    foot: [
      [
        {
          content: "TOTAL SPEND",
          colSpan: 4,
          styles: { halign: "right", fontStyle: "bold" },
        },
        {
          content: formatPdfRs(totalSpend),
          styles: { halign: "right", fontStyle: "bold" },
        },
      ],
    ],
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2.5,
      lineWidth: 0.25,
      lineColor: GRID_BORDER_COLOR,
      textColor: [30, 41, 59],
      valign: "middle",
    },
    headStyles: {
      fillColor: FOOTER_FILL,
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineWidth: 0.25,
      lineColor: GRID_BORDER_COLOR,
    },
    footStyles: {
      fillColor: FOOTER_FILL,
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineWidth: 0.25,
      lineColor: GRID_BORDER_COLOR,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 34 },
      2: { fontStyle: "bold", cellWidth: 46 },
      3: { cellWidth: 62 },
      4: { halign: "right", fontStyle: "bold", cellWidth: 30 },
    },
  });

  cursorY = getLastAutoTableY(doc, cursorY + 20) + 6;

  // 2. Final Payments
  cursorY = drawSectionBanner(
    doc,
    "2. FINAL PAYMENTS",
    cursorY,
    EMERALD_HEADER_FILL
  );

  const totalToSettle = settlements.reduce((sum, s) => sum + s.amount, 0);
  const settleBody =
    settlements.length > 0
      ? settlements.map((s) => [
          memberById.get(s.fromMemberId) ?? "Unknown",
          memberById.get(s.toMemberId) ?? "Unknown",
          formatPdfRs(s.amount),
        ])
      : [["All settled up!", "-", formatPdfRs(0)]];

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    head: [["From (Pay)", "To (Receive)", "Amount"]],
    body: settleBody,
    foot:
      settlements.length > 0
        ? [
            [
              {
                content: "TOTAL TO SETTLE",
                colSpan: 2,
                styles: { halign: "right", fontStyle: "bold" },
              },
              {
                content: formatPdfRs(totalToSettle),
                styles: { halign: "right", fontStyle: "bold" },
              },
            ],
          ]
        : undefined,
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.8,
      lineWidth: 0.25,
      lineColor: GRID_BORDER_COLOR,
      textColor: [30, 41, 59],
      valign: "middle",
    },
    headStyles: {
      fillColor: FOOTER_FILL,
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineWidth: 0.25,
      lineColor: GRID_BORDER_COLOR,
    },
    footStyles: {
      fillColor: FOOTER_FILL,
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineWidth: 0.25,
      lineColor: GRID_BORDER_COLOR,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 68 },
      1: { fontStyle: "bold", cellWidth: 68 },
      2: { halign: "right", fontStyle: "bold", cellWidth: 46 },
    },
  });

  cursorY = getLastAutoTableY(doc, cursorY + 20) + 6;

  // 3. Member Summary
  cursorY = drawSectionBanner(doc, "3. MEMBER SUMMARY", cursorY);

  const memberBody =
    balances.length > 0
      ? balances.map((b) => {
          const status =
            b.netBalance > 0.5
              ? `+${formatPdfRs(b.netBalance)} (Need to Receive)`
              : b.netBalance < -0.5
              ? `-${formatPdfRs(Math.abs(b.netBalance))} (Need to Pay)`
              : "Settled";
          return [
            b.member.name,
            formatPdfRs(b.totalBillsPaid),
            formatPdfRs(b.totalConsumed),
            status,
          ];
        })
      : [["No members added", "-", "-", "-"]];

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    head: [["Name", "Paid", "Used", "Balance"]],
    body: memberBody,
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.8,
      lineWidth: 0.25,
      lineColor: GRID_BORDER_COLOR,
      textColor: [30, 41, 59],
      valign: "middle",
    },
    headStyles: {
      fillColor: FOOTER_FILL,
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineWidth: 0.25,
      lineColor: GRID_BORDER_COLOR,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42 },
      1: { halign: "right", cellWidth: 36 },
      2: { halign: "right", cellWidth: 36 },
      3: { halign: "right", cellWidth: 68, fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const val = String(data.cell.raw ?? "");
        if (val.startsWith("+")) {
          data.cell.styles.textColor = [16, 125, 75];
        } else if (val.startsWith("-")) {
          data.cell.styles.textColor = [190, 24, 60];
        }
      }
    },
  });

  // Simple Footer
  const totalPages = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 10;
    doc.setDrawColor(...GRID_BORDER_COLOR);
    doc.setLineWidth(0.25);
    doc.line(marginX, footerY - 3.5, pageWidth - marginX, footerY - 3.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("TripSplit Offline", marginX, footerY);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, footerY, {
      align: "right",
    });
  }

  const safeName = trip.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  doc.save(`${safeName || "trip"}-expense-statement.pdf`);
}
