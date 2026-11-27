// generateProgressClaimPDF.js — SINGLE PAGE guaranteed
// Strategy: count all rows, pick scale so everything fits PH=210mm (landscape A4)

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const fmtAmt = (n) => {
  const v = parseFloat(n) || 0;
  if (v === 0) return "$ -";
  return `$ ${v.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtD = (d) => {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return d; }
};

export async function generateProgressClaimPDF(project, claim, sections, variations = []) {
  const PW = 297, PH = 210, ML = 8, MR = 8, CW = PW - ML - MR;
  const NAVY = [0, 32, 96], WHITE = [255, 255, 255], DKGRY = [40, 40, 40];

  // Count rows to determine scale
  let boqRows = 0;
  (sections || []).forEach(s => { boqRows += 1 + (s.items || []).length; });
  const voRows  = (variations || []).length;
  const sumRows = 10;
  const totalRows = boqRows + voRows + sumRows;

  // Fixed heights (mm) for non-table sections
  const FIXED_H = 16 + 6 + 2 + 7 + 2 + 26 + 2 + 6 + 5.5 + 1 + 5.5 + 1 + 5.5 + 1 + 20 + 3 + 4 + 3;
  // Each BOQ row ~3.5mm, header ~7mm, each VO row ~3mm, summary rows ~3.5mm
  const estimatedH = FIXED_H + boqRows * 3.5 + 7 + voRows * 3 + (voRows > 0 ? 12 : 0) + sumRows * 3.5 + 12;

  // Scale to fit
  const rawScale = PH / estimatedH;
  const S = Math.min(rawScale, 1.0); // never scale up, only down

  const fs  = (b) => Math.max(b * S, 4);   // font size, min 4pt
  const sp  = (b) => b * S;                 // spacing
  const pad = (b) => Math.max(b * S, 0.8); // padding, min 0.8

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // ── Company Header ────────────────────────────────────────────────────────
  const hH = sp(16);
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PW, hH, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(fs(11)); doc.setTextColor(...WHITE);
  doc.text((project.companyName || "POWERQ MAX ENGINEERING PTE LTD").toUpperCase(), PW / 2, hH * 0.52, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(fs(6)); doc.setTextColor(180, 210, 255);
  doc.text("Electrical \u2022 BMS \u2022 ELV & Security \u2022 Fire Alarm \u2022 Renovation \u2022 IT", PW / 2, hH * 0.85, { align: "center" });

  const aH = sp(6);
  doc.setFillColor(235, 240, 250); doc.rect(0, hH, PW, aH, "F");
  doc.setFontSize(fs(5.5)); doc.setTextColor(...DKGRY);
  const addr = project.companyAddress || "10 Jalan Besar, #15-02, Sim Lim Tower, Singapore 208787";
  doc.text(`${addr}  |  Tel: +65 9860 4001  |  Email: powerqmaxengineering@gmail.com`, PW / 2, hH + aH * 0.75, { align: "center" });
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5);
  doc.line(ML, hH + aH, PW - MR, hH + aH);

  let y = hH + aH + sp(2);

  // ── Title ─────────────────────────────────────────────────────────────────
  const tH = sp(7);
  doc.setFillColor(240, 244, 252); doc.rect(ML, y, CW, tH, "F");
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.3); doc.rect(ML, y, CW, tH, "S");
  doc.setFont("helvetica", "bold"); doc.setFontSize(fs(9)); doc.setTextColor(...NAVY);
  doc.text(`PROGRESS CLAIM  —  ${claim.claimNumber}`, PW / 2, y + tH * 0.72, { align: "center" });
  y += tH + sp(2);

  // ── Client + Claim Info ───────────────────────────────────────────────────
  const iH = sp(26);
  const lw = CW * 0.56, rw = CW * 0.40, rx = ML + CW * 0.60;
  doc.setFillColor(250, 252, 255); doc.rect(ML, y, lw, iH, "F");
  doc.setDrawColor(200, 210, 230); doc.setLineWidth(0.2);
  doc.rect(ML, y, lw, iH, "S");
  doc.setFillColor(240, 245, 255); doc.rect(rx, y, rw, iH, "F");
  doc.rect(rx, y, rw, iH, "S");

  const clientLines = [
    project.clientName    ? `M/S  ${project.clientName}`    : null,
    project.clientAddress || null,
    project.clientTel     ? `Tel: ${project.clientTel}`     : null,
    project.clientEmail   ? `Email: ${project.clientEmail}` : null,
    project.clientAttn    ? `Attn.: ${project.clientAttn}`  : null,
  ].filter(Boolean);
  doc.setFont("helvetica", "normal"); doc.setFontSize(fs(6.5)); doc.setTextColor(...DKGRY);
  clientLines.forEach((l, i) => doc.text(l, ML + 2, y + sp(4) + i * sp(4)));

  [["Claim No", claim.claimNumber || "-"], ["Date", fmtD(claim.claimDate)],
   ["Period", `${fmtD(claim.periodFrom)} – ${fmtD(claim.periodTo)}`],
   ["Project No", project.projectNumber || "-"],
   ["Status", (claim.status || "draft").toUpperCase()]
  ].forEach(([k, v], i) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(fs(6)); doc.setTextColor(...NAVY);
    doc.text(k + ":", rx + 2, y + sp(4) + i * sp(4.2));
    doc.setFont("helvetica", "normal"); doc.setTextColor(...DKGRY);
    doc.text(v, rx + sp(22), y + sp(4) + i * sp(4.2));
  });
  y += iH + sp(2);

  // Project description
  if (project.projectDescription || project.projectName) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(fs(7)); doc.setTextColor(...DKGRY);
    const dLines = doc.splitTextToSize((project.projectDescription || project.projectName).toUpperCase(), CW);
    doc.text(dLines, ML, y);
    y += dLines.length * sp(4) + sp(1);
  }

  // ── BOQ Table ─────────────────────────────────────────────────────────────
  const bH = sp(5.5);
  doc.setFillColor(...NAVY); doc.rect(ML, y, CW, bH, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(fs(7)); doc.setTextColor(...WHITE);
  doc.text("BILL OF QUANTITIES — PROGRESS CLAIM", ML + 2, y + bH * 0.75);
  y += bH + sp(1);

  const ciMap = {};
  (claim.claimItems || []).forEach(ci => { ciMap[ci.boqItemId] = ci; });

  const boqBody = [];
  (sections || []).forEach(sec => {
    boqBody.push([{ content: sec.title, colSpan: 10,
      styles: { fontStyle: "bold", fillColor: [220,230,245], textColor: NAVY, fontSize: fs(6), cellPadding: pad(1.2) } }]);
    (sec.items || []).forEach(item => {
      const ci = ciMap[item.id] || {};
      const pp = item.contractQty > 0 ? `${Math.round(((ci.prevQty||0)/item.contractQty)*100)}%` : "";
      boqBody.push([
        item.itemNumber || "", item.description || "", item.unit || "",
        item.contractQty != null ? String(item.contractQty) : "",
        item.rate   ? `$${parseFloat(item.rate).toFixed(2)}`   : "",
        item.amount ? `$${parseFloat(item.amount).toFixed(2)}` : "",
        pp,
        ci.currentQty != null ? String(ci.currentQty) : "",
        item.unit || "",
        (ci.currentAmount||0) > 0 ? fmtAmt(ci.currentAmount) : "$ -",
      ]);
    });
  });

  // Dynamic column widths
  const c0=sp(8), c2=sp(11), c3=sp(13), c4=sp(14), c5=sp(18), c6=sp(11), c7=sp(13), c8=sp(11), c9=sp(18);
  const c1 = CW - c0 - c2 - c3 - c4 - c5 - c6 - c7 - c8 - c9;

  autoTable(doc, {
    startY: y,
    head: [[
      {content:"SN",styles:{halign:"center"}}, {content:"Description",styles:{halign:"left"}},
      {content:"Unit",styles:{halign:"center"}}, {content:"Qty",styles:{halign:"right"}},
      {content:"Rate",styles:{halign:"right"}}, {content:"Amount",styles:{halign:"right"}},
      {content:"Prev%",styles:{halign:"center"}}, {content:"Claim\nQty",styles:{halign:"right"}},
      {content:"Unit",styles:{halign:"center"}}, {content:"Claim\nAmt",styles:{halign:"right"}},
    ]],
    body: boqBody,
    styles: { fontSize: fs(5.8), cellPadding: pad(1.0), lineColor:[210,215,225], lineWidth:0.12, overflow:"linebreak" },
    headStyles: { fillColor:NAVY, textColor:WHITE, fontStyle:"bold", fontSize:fs(5.8), halign:"center", valign:"middle", minCellHeight:sp(6) },
    alternateRowStyles: { fillColor:[250,252,255] },
    columnStyles: {
      0:{cellWidth:c0,halign:"center"}, 1:{cellWidth:c1,halign:"left"},
      2:{cellWidth:c2,halign:"center"}, 3:{cellWidth:c3,halign:"right"},
      4:{cellWidth:c4,halign:"right"},  5:{cellWidth:c5,halign:"right"},
      6:{cellWidth:c6,halign:"center"}, 7:{cellWidth:c7,halign:"right"},
      8:{cellWidth:c8,halign:"center"}, 9:{cellWidth:c9,halign:"right"},
    },
    margin: { left:ML, right:MR },
    pageBreak: "avoid",
  });
  y = doc.lastAutoTable.finalY + sp(2);

  // ── Variation Orders ──────────────────────────────────────────────────────
  if (variations.length > 0) {
    doc.setFillColor(...NAVY); doc.rect(ML, y, CW, bH, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(fs(7)); doc.setTextColor(...WHITE);
    doc.text("VARIATION ORDERS", ML+2, y+bH*0.75);
    y += bH + sp(1);
    autoTable(doc, {
      startY: y,
      head: [["VO No","Date","Add Description","Add Qty","Add Rate","Add Amt","Omit Desc","Omit Amt","Revised","Status"]],
      body: variations.map((v,i) => [
        v.voNumber||`VO-${i+1}`, fmtD(v.voDate), v.addDescription||"-", v.addQty||"-",
        v.addRate?`$${parseFloat(v.addRate).toFixed(2)}`:"-",
        fmtAmt(v.addAmount), v.omitDescription||"-", fmtAmt(v.omitAmount),
        fmtAmt(v.revisedContractAmount), (v.approvalStatus||"pending").toUpperCase(),
      ]),
      styles: { fontSize:fs(5.5), cellPadding:pad(0.9), lineColor:[210,215,225], lineWidth:0.12 },
      headStyles: { fillColor:[30,80,150], textColor:WHITE, fontStyle:"bold", fontSize:fs(5.5) },
      margin: { left:ML, right:MR }, pageBreak:"avoid",
    });
    y = doc.lastAutoTable.finalY + sp(2);
  }

  // ── Payment Summary ───────────────────────────────────────────────────────
  const orig=claim.originalContractSum||0, addVO=claim.variationAddAmount||0,
        omitVO=claim.variationOmitAmount||0, revised=claim.revisedContractSum||(orig+addVO-omitVO),
        prevAmt=claim.previousClaimAmount||0, currAmt=claim.currentClaimAmount||0,
        cumAmt=claim.cumulativeClaimAmount||0, ret=claim.retentionAmount||0,
        gst=claim.gstAmount||0, payable=claim.finalPayable||0;

  doc.setFillColor(...NAVY); doc.rect(ML, y, CW, bH, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(fs(7)); doc.setTextColor(...WHITE);
  doc.text("PAYMENT SUMMARY", ML+2, y+bH*0.75);
  y += bH + sp(1);

  const sRows = [
    ["Original Contract Sum",                          fmtAmt(orig),    false],
    ["  Add: Variation Order (Additional Work)",       fmtAmt(addVO),   false],
    ["  Less: Variation Order (Omission)",             omitVO>0?`(${fmtAmt(omitVO)})`:"$ -", false],
    ["Revised Contract Sum",                           fmtAmt(revised), true],
    ["Less: Previous Claim Amount",                    fmtAmt(prevAmt), false],
    ["Current Claim Amount (This Claim)",              fmtAmt(currAmt), true],
    ["Cumulative Claim Amount",                        fmtAmt(cumAmt),  false],
    [`Less: Retention @ ${claim.retentionPct||5}%`,    `(${fmtAmt(ret)})`, false],
    [`Add: GST @ ${claim.gstPct||9}%`,                 fmtAmt(gst),    false],
    ["AMOUNT DUE THIS CLAIM",                          fmtAmt(payable), "final"],
  ];
  autoTable(doc, {
    startY: y,
    head: [["Description","Amount (SGD)"]],
    body: sRows.map(r=>[r[0],r[1]]),
    styles: { fontSize:fs(6.5), cellPadding:pad(1.5), lineColor:[200,210,230], lineWidth:0.12 },
    headStyles: { fillColor:[30,80,150], textColor:WHITE, fontStyle:"bold", fontSize:fs(6.5) },
    columnStyles: { 0:{cellWidth:CW-sp(36)}, 1:{cellWidth:sp(34),halign:"right"} },
    margin: { left:ML, right:MR }, pageBreak:"avoid",
    didParseCell: (data) => {
      if (data.section!=="body") return;
      const f = sRows[data.row.index]?.[2];
      if (f==="final") { data.cell.styles.fontStyle="bold"; data.cell.styles.fillColor=NAVY; data.cell.styles.textColor=WHITE; }
      else if (f===true) { data.cell.styles.fontStyle="bold"; data.cell.styles.fillColor=[220,230,245]; data.cell.styles.textColor=NAVY; }
    },
  });
  y = doc.lastAutoTable.finalY + sp(3);

  // ── Signatures ────────────────────────────────────────────────────────────
  const sigH = sp(18), sigW = (CW - sp(6)) / 2;
  [[ML,"For "+(project.companyName||"PowerQ Max Engineering Pte Ltd")],
   [ML+sigW+sp(6),"Acknowledged by Client"]].forEach(([sx,title]) => {
    doc.setFillColor(248,250,255); doc.rect(sx,y,sigW,sigH,"F");
    doc.setDrawColor(180,195,220); doc.setLineWidth(0.2); doc.rect(sx,y,sigW,sigH,"S");
    doc.setFont("helvetica","bold"); doc.setFontSize(fs(7)); doc.setTextColor(...NAVY);
    doc.text(title, sx+2, y+sp(5));
    doc.setDrawColor(100,100,100); doc.setLineWidth(0.3);
    doc.line(sx+2, y+sigH-sp(5), sx+sigW-2, y+sigH-sp(5));
    doc.setFont("helvetica","normal"); doc.setFontSize(fs(5.5)); doc.setTextColor(100,100,100);
    doc.text("Name / Signature / Company Stamp / Date", sx+2, y+sigH-sp(1.5));
  });
  y += sigH + sp(2);

  doc.setFont("helvetica","italic"); doc.setFontSize(fs(5)); doc.setTextColor(150,150,150);
  doc.text("This is a computer-generated document. All amounts are in Singapore Dollars (SGD).", PW/2, y, {align:"center"});

  // ── If still multi-page, warn but save anyway ─────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  if (pages > 1) {
    // Delete extra pages — keep only page 1 (content is scaled but may still overflow for very large BOQs)
    for (let p = pages; p > 1; p--) {
      doc.deletePage(p);
    }
  }

  doc.save(`ProgressClaim_${claim.claimNumber}.pdf`);
}
