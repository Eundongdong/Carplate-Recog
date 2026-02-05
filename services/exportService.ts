
import { ComparisonResult } from "../types";

/**
 * Converts analysis results to CSV and triggers download.
 * Supports Korean characters using UTF-8 BOM.
 */
export const downloadResultsAsCsv = (results: ComparisonResult[]) => {
  if (results.length === 0) return;

  const headers = ["이미지(파일명)", "파일명", "분석 A 결과", "분석 B 결과", "네이버 OCR"];
  
  const csvRows = results.map(res => [
    res.fileName,
    res.fileName,
    res.analysisA.plate || "N/A",
    res.analysisB.plate || "N/A",
    res.naverOcrPlate || "N/A"
  ]);

  const csvContent = [
    headers.join(","),
    ...csvRows.map(row => row.join(","))
  ].join("\n");

  // Add BOM for Excel UTF-8 support
  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  link.setAttribute("href", url);
  link.setAttribute("download", `차량번호_분석_히스토리_${timestamp}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
