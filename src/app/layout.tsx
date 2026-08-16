import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "thirdweb/react";
import { getSiteUrl } from "@/lib/site";

import AccountSync from "@/components/AccountSync";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans" });
const serif = Source_Serif_4({ subsets: ["latin", "cyrillic"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Pager - Web3 Media",
  description: "A minimalist decentralized news platform built on Base. Curated by AI, powered by $HASH.",
  metadataBase: new URL(getSiteUrl()),
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Pager - Web3 Media",
    description: "Minimalist news platform for $HASH holders on Base.",
    url: "/",
    siteName: "Pager",
    images: [
      {
        url: "/logo-pager.png",
        width: 1200,
        height: 630,
        alt: "Pager Web3 Media",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pager - Web3 Media",
    description: "Minimalist news platform for $HASH holders on Base.",
    images: ["/logo-pager.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "AeHDu2LGln-3oDQ7N5z_ZFnlUp6ejYA6ukZo5F-_AVw",
    yandex: "14409f9598171fb3",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${serif.variable} font-sans selection:bg-black selection:text-white`}>
        <ThirdwebProvider>
          <AccountSync />
          {children}
          <Footer />
        </ThirdwebProvider>
      </body>
    </html>
  );
}
