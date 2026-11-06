"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileCheck2,
  FileCode,
  Download,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun,
  Copy,
  RefreshCw,
  FileSpreadsheet,
  Search,
  X,
  FileText,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Users,
  Award,
  Layers,
} from "lucide-react";
import {
  STUDENTS_1RUP8,
  ALLOWED_EXTENSIONS,
  DANGEROUS_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from "../lib/constants";

interface SubmissionItem {
  datetime: string;
  student: string;
  task: string;
  filename: string;
  size_kb: string;
}

interface StatsData {
  total_submissions: number;
  unique_students: number;
  group_size: number;
  percent: number;
}

export default function LabDropPage() {
  // Тема оформления (Dark / Light)
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Состояние формы
  const [student, setStudent] = useState<string>("");
  const [task, setTask] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Экран успешной сдачи
  const [submittedData, setSubmittedData] = useState<{
    student: string;
    task: string;
    filename: string;
    time: string;
    size_kb: string;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string>("Копировать");

  // Данные дашборда и журнала
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [stats, setStats] = useState<StatsData>({
    total_submissions: 0,
    unique_students: 0,
    group_size: 15,
    percent: 0,
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [taskFilter, setTaskFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Инициализация темы
  useEffect(() => {
    const savedTheme = localStorage.getItem("labdrop_theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("labdrop_theme", nextTheme);
  };

  // Загрузка статистики и журнала
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [statsRes, subsRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/submissions"),
        ]);
        if (!isMounted) return;

        if (statsRes.ok) {
          const statsJson = await statsRes.json();
          if (statsJson.status === "ok") {
            setStats({
              total_submissions: statsJson.total_submissions,
              unique_students: statsJson.unique_students,
              group_size: statsJson.group_size,
              percent: statsJson.percent,
            });
          }
        }

        if (subsRes.ok) {
          const subsJson = await subsRes.json();
          if (subsJson.status === "ok") {
            setSubmissions(subsJson.submissions || []);
          }
        }
      } catch (err) {
        console.warn("Ошибка обновления данных журнала:", err);
      }
    };

    load();
    const interval = setInterval(load, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [statsRes, subsRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/submissions"),
      ]);
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.status === "ok") {
          setStats({
            total_submissions: statsJson.total_submissions,
            unique_students: statsJson.unique_students,
            group_size: statsJson.group_size,
            percent: statsJson.percent,
          });
        }
      }
      if (subsRes.ok) {
        const subsJson = await subsRes.json();
        if (subsJson.status === "ok") {
          setSubmissions(subsJson.submissions || []);
        }
      }
    } catch (e) {
      console.warn("Refresh error:", e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // Валидация файла
  const validateFile = (selectedFile: File): boolean => {
    setValidationError(null);

    // 1. Проверка на 0 байт
    if (selectedFile.size === 0) {
      setValidationError("Файл не содержит данных (0 байт)");
      return false;
    }

    // 2. Проверка размера (до 50 МБ)
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setValidationError("Размер файла превышает допустимые 50 МБ");
      return false;
    }

    // 3. Проверка формата файла
    const nameLower = selectedFile.name.toLowerCase();
    for (const badExt of DANGEROUS_EXTENSIONS) {
      if (nameLower.endsWith(badExt)) {
        setValidationError(
          `Файлы типа "${badExt}" запрещены политикой безопасности колледжа. Разрешены: ${ALLOWED_EXTENSIONS.join(", ")}`
        );
        return false;
      }
    }

    const dotIndex = nameLower.lastIndexOf(".");
    const ext = dotIndex !== -1 ? nameLower.slice(dotIndex) : "";
    const isAllowed = ALLOWED_EXTENSIONS.some((allowed) => allowed === ext);

    if (!isAllowed) {
      setValidationError(
        `Формат "${ext || "без расширения"}" недопустим. Разрешены: ${ALLOWED_EXTENSIONS.join(", ")}`
      );
      return false;
    }

    return true;
  };

  const handleFileChange = (selected: File | null) => {
    if (!selected) return;
    if (validateFile(selected)) {
      setFile(selected);
    } else {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Drag and Drop
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Отправка формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !task || !file || isSubmitting) return;

    if (!validateFile(file)) return;

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("student", student);
    formData.append("task", task);
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.status === "ok") {
        setSubmittedData({
          student: data.student,
          task: data.task,
          filename: data.filename,
          time: data.time || new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
          size_kb: `${data.size_kb} КБ`,
        });
        handleRefresh();
      } else {
        setValidationError(data.message || "Ошибка при сохранении работы на сервере");
      }
    } catch (_err) {
      setValidationError("Не удалось связаться с сервером. Проверьте соединение с локальной сетью кабинета.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedData(null);
    setFile(null);
    setTask("");
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCopyFilename = async () => {
    if (!submittedData?.filename) return;
    try {
      await navigator.clipboard.writeText(submittedData.filename);
      setCopyFeedback("Скопировано!");
      setTimeout(() => setCopyFeedback("Копировать"), 2000);
    } catch {
      setCopyFeedback("Ошибка");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 КБ";
    const k = 1024;
    const sizes = ["Б", "КБ", "МБ", "ГБ"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
  };

  // Фильтрация журнала
  const filteredSubmissions = submissions.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      item.student.toLowerCase().includes(q) ||
      item.filename.toLowerCase().includes(q) ||
      item.task.toLowerCase().includes(q);

    let matchesTask = true;
    if (taskFilter !== "all") {
      matchesTask = item.task.includes(`№${taskFilter}`);
    }

    return matchesQuery && matchesTask;
  });

  const isFormValid = Boolean(student && task && file && !validationError);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 flex flex-col gap-6 sm:gap-8">
      {/* 1. ГЛАВНАЯ СТЕКЛЯННАЯ ШАПКА */}
      <header className="glass-panel p-6 sm:p-8 flex flex-col gap-5">
        <div className="glass-specular-line" />
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Кристаллический логотип */}
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 via-teal-500/30 to-cyan-500/25 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-[0_0_25px_rgba(45,212,191,0.35)] shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-teal-400/10 blur-[6px]" />
              <Layers className="w-7 h-7 relative z-10 text-teal-200" />
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-100 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                  LabDrop
                </h1>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  1РУП8
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-300 border border-teal-400/30 flex items-center gap-1 shadow-[0_0_10px_rgba(20,184,166,0.15)]">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-300" /> Strix SecOps
                </span>
              </div>
              <p className="text-sm text-teal-200/80 mt-1 font-medium">
                Мгновенная сдача практических работ. Без логинов и паролей на общих ПК.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              Сервер активен
            </div>

            <button
              onClick={toggleTheme}
              className="glass-btn-secondary p-2.5 rounded-xl text-teal-300 hover:text-white transition-all"
              title="Переключить тему оформления"
              aria-label="Сменить тему"
            >
              {theme === "dark" ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5 text-teal-800" />}
            </button>
          </div>
        </div>

        {/* Инфо-строка авторов и класса */}
        <div className="pt-3.5 border-t border-teal-500/15 flex items-center justify-between flex-wrap gap-2 text-xs text-teal-200/70">
          <div>
            Авторы: <strong className="text-emerald-200 font-semibold">Савченков Артем</strong> (фронтенд) и{" "}
            <strong className="text-emerald-200 font-semibold">Алиев Марат</strong> (бэкенд)
          </div>
          <div className="text-teal-400 font-medium">Компьютерный класс • Группа 1РУП8</div>
        </div>
      </header>

      {/* 2. КАРТОЧКА ЗАДАНИЯ К УРОКУ */}
      <section className="glass-panel p-6 sm:p-7 flex items-center justify-between flex-wrap gap-4">
        <div className="glass-specular-line" />
        <div className="flex items-center gap-4 min-w-[280px]">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/30 border border-teal-400/30 flex items-center justify-center text-teal-300 shadow-[0_0_20px_rgba(20,184,166,0.25)] shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300 bg-teal-500/15 border border-teal-400/30 px-2.5 py-0.5 rounded-full">
              Текущий урок
            </span>
            <h2 className="text-base sm:text-lg font-bold text-emerald-50 mt-1">
              Задание к сегодняшнему занятию
            </h2>
            <p className="text-xs sm:text-sm text-teal-200/70">
              Скачайте файл с методичкой в 1 клик без входа в мессенджер Макс (российский мессенджер)
            </p>
          </div>
        </div>

        <a
          href="/tasks/zadanie_current.pdf"
          download="zadanie_current.pdf"
          className="glass-btn-secondary px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 w-full sm:w-auto shadow-md hover:border-teal-400/60 transition-all"
        >
          <Download className="w-4 h-4 text-teal-300" />
          <span>Скачать задание (.pdf)</span>
        </a>
      </section>

      {/* 3. ОСНОВНАЯ ФОРМА СДАЧИ РАБОТЫ */}
      {!submittedData ? (
        <section className="glass-panel p-6 sm:p-8">
          <div className="glass-specular-line" />
          <div className="mb-6">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-50">
                Форма сдачи выполненной работы
              </h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-300 border border-teal-400/30 shadow-[0_0_10px_rgba(20,184,166,0.2)]">
                Сдача за 20 секунд
              </span>
            </div>
            <p className="text-sm text-teal-200/70 mt-1.5">
              Файл автоматически сохранится по стандарту колледжа:{" "}
              <code className="text-xs font-mono text-teal-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-teal-500/30 shadow-inner">
                1RUP8_Фамилия_Работа[№].[расширение]
              </code>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Honeypot поле для защиты от спам-ботов */}
            <input
              type="text"
              name="middle_name_check"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
            />

            {/* Выбор студента и номера работы */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="studentSelect" className="text-sm font-semibold text-emerald-100">
                  Студент группы 1РУП8 <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <select
                    id="studentSelect"
                    value={student}
                    onChange={(e) => setStudent(e.target.value)}
                    required
                    className="glass-input w-full h-12 px-4 pr-10 rounded-xl text-sm appearance-none outline-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-[#04120e] text-teal-400">
                      — Выберите свою фамилию —
                    </option>
                    {STUDENTS_1RUP8.map((name) => (
                      <option key={name} value={name} className="bg-[#04120e] text-emerald-100">
                        {name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-teal-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="taskSelect" className="text-sm font-semibold text-emerald-100">
                  Номер практической работы <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <select
                    id="taskSelect"
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    required
                    className="glass-input w-full h-12 px-4 pr-10 rounded-xl text-sm appearance-none outline-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-[#04120e] text-teal-400">
                      — Выберите номер работы —
                    </option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={String(num)} className="bg-[#04120e] text-emerald-100">
                        Практическая работа №{num}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-teal-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Drag and Drop Зона загрузки файла */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-emerald-100">
                Файл с выполненным заданием <span className="text-rose-400">*</span>
              </label>

              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !file && fileInputRef.current?.click()}
                className={`glass-dropzone p-6 sm:p-8 text-center cursor-pointer ${
                  isDragging ? "active" : ""
                } ${validationError ? "border-rose-500/50 bg-rose-950/20" : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.doc,.pdf,.py,.zip,.rar,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />

                {!file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/25 to-cyan-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-[0_0_20px_rgba(45,212,191,0.25)]">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-medium text-emerald-100">
                        Перетащите файл сюда или{" "}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="text-teal-300 font-bold underline hover:text-teal-200 transition-colors"
                        >
                          выберите на компьютере
                        </button>
                      </p>
                      <div className="flex items-center justify-center gap-1.5 flex-wrap mt-2.5">
                        {ALLOWED_EXTENSIONS.map((ext) => (
                          <span
                            key={ext}
                            className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-950/50 border border-teal-500/25 text-teal-300"
                          >
                            {ext}
                          </span>
                        ))}
                        <span className="text-xs text-teal-200/60 ml-1">• до 50 МБ</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-[#031510]/85 border border-teal-400/35 rounded-xl shadow-lg backdrop-blur-xl">
                    <div className="flex items-center gap-3.5 text-left overflow-hidden">
                      <div className="px-3 py-2 rounded-lg bg-teal-500/20 text-teal-300 font-mono text-xs font-bold border border-teal-400/40">
                        {file.name.split(".").pop()?.toUpperCase() || "FILE"}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-sm font-semibold text-emerald-50 truncate max-w-[280px] sm:max-w-md">
                          {file.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-teal-200/70 mt-0.5">
                          <span className="font-mono text-teal-300">{formatBytes(file.size)}</span>
                          <span className="text-emerald-300 font-medium flex items-center gap-1">
                            <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" /> Готов к отправке
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={clearFile}
                      className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 text-teal-300 hover:text-rose-300 transition-colors shrink-0"
                      title="Удалить выбранный файл"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Сообщение об ошибке валидации */}
              {validationError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs sm:text-sm font-medium mt-1 backdrop-blur-md">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Кнопка отправки */}
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 transition-all ${
                isFormValid && !isSubmitting
                  ? "glass-btn-primary cursor-pointer"
                  : "bg-emerald-950/30 text-teal-500/40 border border-teal-500/15 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Отправка работы на сервер...</span>
                </>
              ) : (
                <>
                  <span>Сдать работу</span>
                  <CheckCircle2 className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </section>
      ) : (
        /* 4. ЭКРАН ПОДТВЕРЖДЕНИЯ СДАЧИ */
        <section className="glass-panel p-8 sm:p-10 text-center flex flex-col items-center">
          <div className="glass-specular-line" />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/30 via-teal-500/30 to-cyan-500/30 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(16,185,129,0.45)]">
            <CheckCircle2 className="w-10 h-10 text-emerald-300" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-50">Работа успешно принята!</h2>
          <p className="text-sm text-teal-200/80 mt-1 max-w-md">
            Файл зарегистрирован в журнале преподавателя и сохранен на сервере кабинета.
          </p>

          <div className="w-full max-w-lg bg-[#031510]/85 border border-teal-400/35 rounded-2xl p-6 my-6 flex flex-col gap-3 text-left shadow-xl backdrop-blur-xl">
            <div className="flex justify-between items-center text-sm py-1.5 border-b border-teal-500/15">
              <span className="text-teal-200/70 font-medium">Студент:</span>
              <strong className="text-emerald-100 font-semibold">{submittedData.student}</strong>
            </div>

            <div className="flex justify-between items-center text-sm py-1.5 border-b border-teal-500/15">
              <span className="text-teal-200/70 font-medium">Задание:</span>
              <strong className="text-emerald-100 font-semibold">{submittedData.task}</strong>
            </div>

            <div className="flex justify-between items-center text-sm py-1.5 border-b border-teal-500/15">
              <span className="text-teal-200/70 font-medium">Имя на сервере:</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs text-teal-300 bg-teal-950/70 px-2.5 py-1 rounded border border-teal-400/30">
                  {submittedData.filename}
                </code>
                <button
                  type="button"
                  onClick={handleCopyFilename}
                  className="glass-btn-secondary px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5 text-teal-300" />
                  <span>{copyFeedback}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-sm py-1.5 border-b border-teal-500/15">
              <span className="text-teal-200/70 font-medium">Время сдачи:</span>
              <span className="font-mono text-teal-300 font-bold">{submittedData.time}</span>
            </div>

            <div className="flex justify-between items-center text-sm py-1.5">
              <span className="text-teal-200/70 font-medium">Размер файла:</span>
              <span className="text-emerald-100 font-mono">{submittedData.size_kb}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetForm}
            className="glass-btn-secondary px-7 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg"
          >
            <RefreshCw className="w-4 h-4 text-teal-300" />
            <span>Сдать еще одну работу</span>
          </button>
        </section>
      )}

      {/* 5. МОНИТОР СТАРОСТЫ И ПРЕПОДАВАТЕЛЯ (DASHBOARD) */}
      <section className="glass-panel p-6 sm:p-8">
        <div className="glass-specular-line" />
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.25)]">
              <FileCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-emerald-50">Монитор сдачи работ (Группа 1РУП8)</h3>
              <p className="text-xs text-teal-200/70">Сводка для старосты и преподавателя на текущей паре</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefresh}
              className="glass-btn-secondary px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-300 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Обновить</span>
            </button>

            <a
              href="/api/download-log"
              className="glass-btn-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Экспорт в Excel (.csv)</span>
            </a>
          </div>
        </div>

        {/* 4 Виджета статистики */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
          <div className="p-4 rounded-2xl bg-[#031510]/80 border border-teal-400/25 shadow-md">
            <span className="text-xs text-teal-200/70 font-medium">Всего сдано</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-100 mt-1">
              {stats.total_submissions}
            </div>
            <div className="text-[11px] text-teal-400 mt-0.5">работ на сервере</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#031510]/80 border border-teal-400/25 shadow-md">
            <span className="text-xs text-teal-200/70 font-medium">Студентов сдали</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-200 mt-1">
              {stats.unique_students} <span className="text-sm font-normal text-teal-400">/ 15</span>
            </div>
            <div className="text-[11px] text-teal-400 mt-0.5">человек из 1РУП8</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#031510]/80 border border-teal-400/25 shadow-md">
            <span className="text-xs text-teal-200/70 font-medium">Охват группы</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300 mt-1">
              {stats.percent}%
            </div>
            <div className="w-full bg-emerald-950/60 h-1.5 rounded-full overflow-hidden mt-1.5 border border-teal-500/20">
              <div
                className="bg-gradient-to-r from-emerald-400 to-teal-300 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(stats.percent, 100)}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#031510]/80 border border-teal-400/25 shadow-md">
            <span className="text-xs text-teal-200/70 font-medium">Статус класса</span>
            <div className="text-base sm:text-lg font-bold text-emerald-200 mt-1 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              Активен
            </div>
            <div className="text-[11px] text-teal-400 mt-0.5">Кабинет подключен</div>
          </div>
        </div>

        {/* Поиск и фильтрация */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 text-teal-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по фамилии студента или файлу..."
              className="glass-input w-full h-11 pl-10 pr-4 rounded-xl text-sm outline-none"
            />
          </div>

          <div className="relative w-full sm:w-56">
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              className="glass-input w-full h-11 px-4 pr-10 rounded-xl text-sm appearance-none outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#04120e] text-teal-300">Все практические</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)} className="bg-[#04120e] text-emerald-100">
                  Работа №{n}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-teal-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Таблица сданных работ */}
        <div className="overflow-x-auto rounded-xl border border-teal-500/25 bg-[#031510]/70 backdrop-blur-md">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#020d09]/90 text-[11px] uppercase tracking-wider text-teal-300/80 border-b border-teal-500/20 font-semibold">
              <tr>
                <th className="py-3 px-4">Студент</th>
                <th className="py-3 px-4">Задание</th>
                <th className="py-3 px-4">Имя файла на сервере</th>
                <th className="py-3 px-4">Время</th>
                <th className="py-3 px-4">Размер</th>
                <th className="py-3 px-4 text-right">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-500/15">
              {filteredSubmissions.length > 0 ? (
                filteredSubmissions.map((item, idx) => (
                  <tr key={idx} className="hover:bg-teal-500/10 transition-colors">
                    <td className="py-3 px-4 font-semibold text-emerald-50">{item.student}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {item.task}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-teal-300">{item.filename}</td>
                    <td className="py-3 px-4 text-xs text-teal-200/70 font-mono">{item.datetime.slice(11, 16)}</td>
                    <td className="py-3 px-4 text-xs text-teal-200/80">{item.size_kb} КБ</td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Сдано
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-teal-200/60 text-sm">
                    {searchQuery ? "По данному запросу ничего не найдено" : "Сданных работ пока нет. Будьте первыми!"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. ФУТЕР */}
      <footer className="text-center text-xs text-teal-200/60 pb-6 flex flex-col gap-1">
        <p>© 2026 LabDrop | 1РУП8. Разработано для компьютерных классов колледжа.</p>
        <p className="text-teal-400/80">
          Авторы: Савченков Артем (Frontend / UX) и Алиев Марат (Backend / Git / SecOps)
        </p>
      </footer>
    </main>
  );
}
