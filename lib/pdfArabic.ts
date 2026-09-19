"use client";

import ArabicReshaper from "arabic-reshaper";
import bidiFactory from "bidi-js";
import type { jsPDF } from "jspdf";

const bidi = bidiFactory();

/**
 * jsPDF has no built-in Arabic glyph shaping or bidi reordering — it just draws
 * codepoints left-to-right using whatever glyph the font's cmap maps them to.
 * This reshapes Arabic letters into their joined presentation forms and reorders
 * the string into left-to-right *visual* order (numbers/Latin runs stay put),
 * so drawing it normally (no RTL flag) renders correctly.
 * No-op for strings with no Arabic content.
 */
export function shapeArabicForPdf(text: string): string {
  const shaped = ArabicReshaper.convertArabic(text);
  const embeddingLevels = bidi.getEmbeddingLevels(shaped);
  const flips = bidi.getReorderSegments(shaped, embeddingLevels);
  const chars = [...shaped];
  for (const [start, end] of flips) {
    let lo = start;
    let hi = end;
    while (lo < hi) {
      const tmp = chars[lo];
      chars[lo] = chars[hi];
      chars[hi] = tmp;
      lo++;
      hi--;
    }
  }
  return chars.join("");
}

export const ARABIC_FONT = "Amiri";

let cachedFontBase64: string | null = null;

async function fetchFontBase64(): Promise<string> {
  if (cachedFontBase64) return cachedFontBase64;
  const res = await fetch("/fonts/Amiri-Regular.ttf");
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  cachedFontBase64 = btoa(binary);
  return cachedFontBase64;
}

/** Registers the Amiri Arabic font with a jsPDF document. Call once per document. */
export async function registerArabicFont(doc: jsPDF): Promise<void> {
  const base64 = await fetchFontBase64();
  doc.addFileToVFS("Amiri-Regular.ttf", base64);
  doc.addFont("Amiri-Regular.ttf", ARABIC_FONT, "normal");
  doc.addFont("Amiri-Regular.ttf", ARABIC_FONT, "bold");
}
