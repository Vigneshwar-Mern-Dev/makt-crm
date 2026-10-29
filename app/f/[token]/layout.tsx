import { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "தொடர்பு விவரங்கள் | Contact Details - MAKT",
  description: "MAKT ATM Franchise பற்றி உங்கள் விவரங்களை வழங்கவும். Provide your details to get started with MAKT ATM Franchise.",
};

export default function FormLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 selection:bg-cyan-300/30">
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
