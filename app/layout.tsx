import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Refuel. Rebuild. Return. — A rehabilitation program for Shantha",
  description:
    "RED-S rehabilitation pitch by Kyle Marambio, Sports Trainer & S&C Coach: a criteria-based recovery plan for Shantha.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
