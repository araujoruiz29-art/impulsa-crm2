import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "impulsa CRM · Plataforma Multiempresa · Ventas, Proformas, WhatsApp e IA",
  description:
    "Impulsa CRM multiempresa: clientes, embudo Kanban, facturas proforma PDF, correo corporativo SMTP/IMAP, Meta Cloud API, audios y Agente de IA.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "impulsa CRM",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/brand/impulsa-symbol.svg",
    apple: "/brand/impulsa-symbol.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e1046",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
