import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TR ADO",
  description: "TR ADO — Boards, Repos, Pipelines",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
