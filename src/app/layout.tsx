import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "NiteshPro — Premium Fitness Club", template: "%s · NiteshPro" },
  description:
    "NiteshPro is a premium fitness club in Mumbai — elite coaching, world-class equipment, group classes and a member portal that makes training effortless.",
  keywords: ["gym", "fitness", "premium gym", "membership", "personal training", "group classes", "NiteshPro"],
  openGraph: { title: "NiteshPro — Premium Fitness Club", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
