import type { Metadata } from "next";

// page.tsx est un Client Component (`"use client"`) : il ne peut pas exporter
// `metadata` lui-même. Ce layout, lui, le peut — c'est l'outil de génération
// des vignettes, jamais une page du site, elle ne doit pas être indexée.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PackshotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
