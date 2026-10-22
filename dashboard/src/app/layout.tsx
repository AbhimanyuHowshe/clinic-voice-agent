import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clinic AI Receptionist",
  description: "Demo AI voice receptionist and staff dashboard for clinics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
