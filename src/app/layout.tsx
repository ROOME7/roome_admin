import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

// RooMe design system: Inter for body, Poppins for headings.
// next/font preconnects + self-hosts, so no FOUT and no Google round-trip.

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RooMe Admin",
  description: "Internal admin panel for the RooMe marketplace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
