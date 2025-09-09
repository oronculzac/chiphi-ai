import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { GeistMono } from "geist/font/mono"
// import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { AuthProvider } from "@/components/auth/auth-provider"
import { GlobalErrorBoundary } from "@/components/global-error-boundary"
import { LocaleProvider } from "@/components/providers/locale-provider"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "ChiPhi AI - Turn inbox receipts into clear, trustworthy spend data",
  description: "AI-powered receipt processing that translates any language, extracts structured data, and generates reports automatically.",
  generator: "ChiPhi AI",
  openGraph: {
    title: "ChiPhi AI - AI-Powered Receipt Processing",
    description: "Transform emailed receipts into structured financial data with multilingual AI processing and explainable insights.",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "ChiPhi AI - Receipt Processing Dashboard"
      }
    ],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Load default locale messages
  const locale = 'en'; // Default to English for now
  const messages = (await import(`../messages/${locale}.json`)).default;

  return (
    <html lang={locale}>
      <body className={`font-sans antialiased ${inter.variable} ${GeistMono.variable}`}>
        <GlobalErrorBoundary>
          <LocaleProvider messages={messages} locale={locale}>
            <AuthProvider>
              <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center bg-background">
                  <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  </div>
                </div>
              }>
                {children}
              </Suspense>
            </AuthProvider>
          </LocaleProvider>
        </GlobalErrorBoundary>
        {/* <Analytics /> */}
      </body>
    </html>
  )
}
