import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabDrop | 1РУП8 — Сдача практических работ",
  description:
    "Быстрая сдача практических работ в компьютерном классе колледжа без входа в личные аккаунты. Авторы: Алиев Марат и Савченков Артем (1РУП8).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" data-theme="dark">
      <body className="antialiased selection:bg-teal-500/25 selection:text-teal-400">
        {/* Спокойный мягкий фоновый свет без перегрузки */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[450px] rounded-full bg-gradient-to-b from-teal-500/10 via-emerald-500/5 to-transparent blur-[120px]" />
          <div className="absolute -bottom-40 right-10 w-[500px] h-[400px] rounded-full bg-gradient-to-t from-teal-600/5 to-transparent blur-[130px]" />
        </div>

        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
