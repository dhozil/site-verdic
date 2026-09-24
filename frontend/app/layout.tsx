import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import "./globals.css";

const sign = Barlow_Condensed({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sign",
});

export const metadata: Metadata = {
  title: {
    default: "SiteVerdict: renovation work settled by photo evidence",
    template: "%s: SiteVerdict",
  },
  description:
    "Post renovation jobs, prove completion with before-and-after photos, and settle by independent AI validator verdict.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full ${sign.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
