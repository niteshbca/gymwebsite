import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "FitPro — Premium Gym Management", template: "%s · FitPro" },
  description:
    "FitPro is a complete gym management platform: memberships, payments, attendance, trainers, classes and a premium public website.",
  keywords: ["gym", "fitness", "membership management", "gym software", "personal training"],
  openGraph: { title: "FitPro — Premium Gym Management", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
