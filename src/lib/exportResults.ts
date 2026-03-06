import { type CandidateAnalysis } from "@/lib/analysisEngine";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, BorderStyle } from "docx";
import { saveAs } from "file-saver";

function buildTextReport(results: CandidateAnalysis[], jobDesc: string): string {
  const lines: string[] = [];
  lines.push("CANDIDATE SCREENING REPORT");
  lines.push("=".repeat(50));
  lines.push(`Generated: ${new Date().toLocaleDateString()}`);
  lines.push(`Candidates Screened: ${results.length}`);
  lines.push(`Recommended for Interview: ${results.filter((r) => r.recommendation === "interview").length}`);
  lines.push("");
  lines.push("JOB DESCRIPTION:");
  lines.push("-".repeat(30));
  lines.push(jobDesc.slice(0, 500));
  lines.push("");
  lines.push("RANKINGS:");
  lines.push("-".repeat(30));

  results.forEach((r, i) => {
    lines.push(`\n#${i + 1} ${r.name}`);
    lines.push(`   Score: ${r.score}%`);
    lines.push(`   Recommendation: ${r.recommendation.toUpperCase()}`);
    lines.push(`   Matched Skills: ${r.matchedSkills.join(", ") || "None"}`);
    lines.push(`   Gaps: ${r.gaps.join(", ") || "None"}`);
  });

  return lines.join("\n");
}

export function exportToText(results: CandidateAnalysis[], jobDesc: string) {
  const text = buildTextReport(results, jobDesc);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  saveAs(blob, "screening-results.txt");
}

export function exportToPDF(results: CandidateAnalysis[], jobDesc: string) {
  const doc = new jsPDF();
  const margin = 15;
  let y = margin;
  const lineH = 6;

  const addLine = (text: string, bold = false, size = 10) => {
    if (y > 270) { doc.addPage(); y = margin; }
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, 180);
    lines.forEach((line: string) => {
      if (y > 270) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += lineH;
    });
  };

  addLine("Candidate Screening Report", true, 18);
  y += 4;
  addLine(`Generated: ${new Date().toLocaleDateString()}`, false, 9);
  addLine(`Candidates: ${results.length} | Recommended: ${results.filter((r) => r.recommendation === "interview").length}`, false, 9);
  y += 6;

  results.forEach((r, i) => {
    addLine(`#${i + 1}  ${r.name}  —  ${r.score}%  [${r.recommendation.toUpperCase()}]`, true, 12);
    addLine(`Matched: ${r.matchedSkills.join(", ") || "None"}`);
    addLine(`Gaps: ${r.gaps.join(", ") || "None"}`);
    y += 4;
  });

  doc.save("screening-results.pdf");
}

export async function exportToWord(results: CandidateAnalysis[], jobDesc: string) {
  const rows = results.map((r, i) =>
    new DocxTableRow({
      children: [
        new DocxTableCell({ children: [new Paragraph(`#${i + 1}`)], width: { size: 8, type: WidthType.PERCENTAGE } }),
        new DocxTableCell({ children: [new Paragraph(r.name)], width: { size: 22, type: WidthType.PERCENTAGE } }),
        new DocxTableCell({ children: [new Paragraph(`${r.score}%`)], width: { size: 12, type: WidthType.PERCENTAGE } }),
        new DocxTableCell({ children: [new Paragraph(r.recommendation.toUpperCase())], width: { size: 16, type: WidthType.PERCENTAGE } }),
        new DocxTableCell({ children: [new Paragraph(r.matchedSkills.join(", ") || "None")], width: { size: 22, type: WidthType.PERCENTAGE } }),
        new DocxTableCell({ children: [new Paragraph(r.gaps.join(", ") || "None")], width: { size: 20, type: WidthType.PERCENTAGE } }),
      ],
    })
  );

  const headerRow = new DocxTableRow({
    children: ["#", "Name", "Score", "Recommendation", "Matched Skills", "Gaps"].map(
      (h) =>
        new DocxTableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
          shading: { fill: "E2E8F0" },
        })
    ),
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Candidate Screening Report", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `Generated: ${new Date().toLocaleDateString()}` }),
          new Paragraph({ text: `Candidates: ${results.length} | Recommended for Interview: ${results.filter((r) => r.recommendation === "interview").length}` }),
          new Paragraph({ text: "" }),
          new DocxTable({ rows: [headerRow, ...rows], width: { size: 100, type: WidthType.PERCENTAGE } }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "screening-results.docx");
}

export function exportToExcel(results: CandidateAnalysis[], jobDesc: string) {
  const headers = ["Rank", "Name", "Score (%)", "Recommendation", "Matched Skills", "Gaps"];
  const rows = results.map((r, i) => [
    i + 1,
    r.name,
    r.score,
    r.recommendation.toUpperCase(),
    r.matchedSkills.join("; "),
    r.gaps.join("; "),
  ]);

  // Build CSV (Excel-compatible)
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
  saveAs(blob, "screening-results.csv");
}
