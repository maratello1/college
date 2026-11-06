import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabDrop | 1РУП8 — Сдача практических работ",
  description:
    "Быстрая сдача практических работ в компьютерном классе колледжа без входа в личные аккаунты. Авторы: Алиев Марат и Савченков Артем (1РУП8).",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" data-theme="dark">
      <body className="antialiased selection:bg-teal-500/25 selection:text-teal-400">
        {/* Спокойный ультра-тонкий фоновый свет без кислотно-зеленых пятен */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full bg-gradient-to-b from-teal-500/[0.04] to-transparent blur-[140px]" />
        </div>

        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
