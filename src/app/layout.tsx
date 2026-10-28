import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, siteUrl } from "@/lib/site";
import { SessionProvider } from "@/components/SessionProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { HelpWidget } from "@/components/help/HelpWidget";
import { HtmlLangSync } from "@/components/HtmlLangSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  // Read APP_URL per request, not at build time: one image serves several names
  await connection();
  const url = siteUrl();
  return {
    metadataBase: url ? new URL(url) : undefined,
    title: {
      default: `${SITE_NAME}: plan open water swimming courses on a map`,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: SITE_KEYWORDS,
    applicationName: SITE_NAME,
    category: "sports",
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: `${SITE_NAME}: plan open water swimming courses on a map`,
      description: SITE_DESCRIPTION,
      locale: "en",
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
    },
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <HtmlLangSync />
        <SessionProvider>
          <QueryProvider>
            {children}
            <HelpWidget />
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
