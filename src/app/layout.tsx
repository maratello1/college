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
      <body className="antialiased selection:bg-teal-400/30 selection:text-teal-200 bg-[#030706]">
        {/* АТМОСФЕРНЫЙ СВЕТОВОЙ СЛОЙ: ЛЕСНОЙ ИЗУМРУД И ТУРМАЛИНОВЫЙ ТУРКУАЗ */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
          {/* Сетка тонких технических точек */}
          <div className="absolute inset-0 bg-grid-dots opacity-40" />

          {/* 1. Главная северная туманность (Альпийский бирюзовый) */}
          <div className="absolute -top-32 -left-20 w-[680px] h-[680px] rounded-full bg-gradient-to-br from-teal-500/25 via-emerald-600/20 to-transparent blur-[140px] animate-orb-float" />

          {/* 2. Глубокий лесной изумруд (Forest Pine) */}
          <div className="absolute -bottom-40 -right-20 w-[720px] h-[720px] rounded-full bg-gradient-to-tl from-emerald-700/30 via-teal-800/20 to-transparent blur-[150px] animate-orb-float [animation-delay:4s]" />

          {/* 3. Центральный кристаллический фокус (Electric Turquoise / Aquamarine) */}
          <div className="absolute top-1/4 right-1/4 w-[520px] h-[520px] rounded-full bg-gradient-to-tr from-cyan-400/20 via-teal-500/15 to-transparent blur-[130px] animate-orb-float [animation-delay:2s]" />

          {/* 4. Нижний лесной акцент */}
          <div className="absolute bottom-10 left-1/4 w-[480px] h-[480px] rounded-full bg-emerald-900/30 blur-[130px] animate-orb-float [animation-delay:6s]" />

          {/* Тонкий физический шум (Film Grain) для имитации фактуры матового стекла */}
          <div
            className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* ОСНОВНОЙ КОНТЕНТ */}
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
