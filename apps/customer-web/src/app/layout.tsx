import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/query";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Brodoudou — Shop together, save together", template: "%s · Brodoudou" },
  description: "Brodoudou is a social commerce marketplace. Team up with friends in group buys and unlock lower prices.",
};

export const viewport: Viewport = {
  themeColor: "#FF6A3D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          <Navbar />
          <main className="container-page min-h-[60vh] pb-28 pt-6 md:pb-10">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
