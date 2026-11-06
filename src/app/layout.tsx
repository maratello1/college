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
      <body className="antialiased selection:bg-accent-cyan/20 selection:text-accent-cyan">
        {/* Атмосферные градиентные сферы для стеклянного преломления */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
          <div className="absolute -top-40 -left-32 w-[550px] h-[550px] rounded-full bg-blue-600/30 blur-[130px] animate-orb-float" />
          <div className="absolute -bottom-40 -right-32 w-[600px] h-[600px] rounded-full bg-indigo-600/25 blur-[140px] animate-orb-float [animation-delay:4s]" />
          <div className="absolute top-1/3 left-1/3 w-[450px] h-[450px] rounded-full bg-cyan-500/20 blur-[120px] animate-orb-float [animation-delay:2s]" />
        </div>

        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
