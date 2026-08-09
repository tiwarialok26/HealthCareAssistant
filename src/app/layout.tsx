import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Medicare Hub - Hospital Booking & AI Healthcare Assistant",
  description: "Book doctor appointments and receive instant AI healthcare guidance in English, Hindi, and Hinglish.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <Navbar />
        <div className="flex-grow flex flex-col">{children}</div>
      </body>
    </html>
  );
}
