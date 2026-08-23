import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ToastBridge } from "@/components/Toast";
import RootLayout from "@/components/RootLayout";

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "Delphic Admin",
  description: "Delphic Admin Panel",
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className={`h-full ${ibmPlexMono.className}`}>
        <ToastBridge>
          <RootLayout>{children}</RootLayout>
        </ToastBridge>
      </body>
    </html>
  );
}