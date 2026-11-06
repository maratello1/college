"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileCheck2,
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
  ChevronDown,
  ChevronUp,
  KeyRound,
  Lock,
  Unlock,
  Monitor,
  Check,
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

interface TokenItem {
  token: string;
  used: boolean;
  used_at: string | null;
  task?: string | null;
  filename?: string | null;
}

interface TokensSession {
  is_active: boolean;
  is_locked: boolean;
  created_at: string | null;
  tokens: Record<string, TokenItem>;
}

export default function LabDropPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [student, setStudent] = useState<string>("");
  const [task, setTask] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Статус активности токенов (от сервера)
  const [tokensActive, setTokensActive] = useState<boolean>(false);
  const [tokensLocked, setTokensLocked] = useState<boolean>(false);

  // Модалка преподавателя
  const [showTeacherModal, setShowTeacherModal] = useState<boolean>(false);
  const [teacherPin, setTeacherPin] = useState<string>("");
  const [isTeacherAuthed, setIsTeacherAuthed] = useState<boolean>(false);
  const [teacherSession, setTeacherSession] = useState<TokensSession | null>(null);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [teacherSuccess, setTeacherSuccess] = useState<string | null>(null);
  const [showProjectorMode, setShowProjectorMode] = useState<boolean>(false);

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
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showMonitor, setShowMonitor] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("labdrop_theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("labdrop_theme", nextTheme);
  };

  // Загрузка статистики, журнала и статуса токенов
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [statsRes, subsRes, tokensRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/submissions"),
          fetch("/api/tokens"),
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

        if (tokensRes.ok) {
          const tokensJson = await tokensRes.json();
          if (tokensJson.status === "ok") {
            setTokensActive(Boolean(tokensJson.is_active));
            setTokensLocked(Boolean(tokensJson.is_locked));
          }
        }
      } catch (err) {
        console.warn("Ошибка загрузки данных:", err);
      }
    };

    load();
    const interval = setInterval(load, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [statsRes, subsRes, tokensRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/submissions"),
        fetch("/api/tokens"),
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
      if (tokensRes.ok) {
        const tokensJson = await tokensRes.json();
        if (tokensJson.status === "ok") {
          setTokensActive(Boolean(tokensJson.is_active));
          setTokensLocked(Boolean(tokensJson.is_locked));
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

    if (selectedFile.size === 0) {
      setValidationError("Файл не содержит данных (0 байт)");
      return false;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setValidationError("Размер файла превышает 50 МБ");
      return false;
    }

    const nameLower = selectedFile.name.toLowerCase();
    for (const badExt of DANGEROUS_EXTENSIONS) {
      if (nameLower.endsWith(badExt)) {
        setValidationError(`Файлы типа "${badExt}" запрещены`);
        return false;
      }
    }

    const dotIndex = nameLower.lastIndexOf(".");
    const ext = dotIndex !== -1 ? nameLower.slice(dotIndex) : "";
    const isAllowed = ALLOWED_EXTENSIONS.some((allowed) => allowed === ext);

    if (!isAllowed) {
      setValidationError(`Формат "${ext || "без расширения"}" не поддерживается`);
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

  // Отправка формы сдачи
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !task || !file || isSubmitting) return;

    if (tokensActive && !token.trim()) {
      setValidationError("Введите одноразовый код от преподавателя");
      return;
    }

    if (!validateFile(file)) return;

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("student", student);
    formData.append("task", task);
    formData.append("file", file);
    if (tokensActive) {
      formData.append("token", token.trim());
    }

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
        setToken("");
        handleRefresh();
      } else {
        setValidationError(data.message || "Ошибка при сохранении файла");
      }
    } catch (_err) {
      setValidationError("Не удалось связаться с сервером");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedData(null);
    setFile(null);
    setTask("");
    setToken("");
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCopyFilename = async () => {
    if (!submittedData?.filename) return;
    try {
      await navigator.clipboard.writeText(submittedData.filename);
      setCopyFeedback("Скопировано");
      setTimeout(() => setCopyFeedback("Копировать"), 2000);
    } catch {
      setCopyFeedback("Ошибка");
    }
  };

  // ==========================================
  // ЛОГИКА ПАНЕЛИ ПРЕПОДАВАТЕЛЯ (УПРАВЛЕНИЕ ТОКЕНАМИ)
  // ==========================================
  const handleTeacherAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: teacherPin.trim(), action: "verify_pin" }),
      });
      const data = await res.json();
      if (res.ok && data.status === "ok") {
        setIsTeacherAuthed(true);
        setTeacherSession(data.session);
        setTokensActive(Boolean(data.session?.is_active));
        setTokensLocked(Boolean(data.session?.is_locked));
      } else {
        setTeacherError(data.message || "Неверный пароль");
      }
    } catch {
      setTeacherError("Ошибка связи с сервером");
    }
  };

  const executeTeacherAction = async (action: string, targetStudent?: string) => {
    setTeacherError(null);
    setTeacherSuccess(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: teacherPin.trim(),
          action,
          student: targetStudent,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === "ok") {
        setTeacherSession(data.session);
        setTokensActive(Boolean(data.session?.is_active));
        setTokensLocked(Boolean(data.session?.is_locked));
        setTeacherSuccess(data.message);
        setTimeout(() => setTeacherSuccess(null), 3000);
      } else {
        setTeacherError(data.message || "Ошибка выполнения");
      }
    } catch {
      setTeacherError("Ошибка связи с сервером");
    }
  };

  const copyTokensToClipboard = async () => {
    if (!teacherSession?.tokens) return;
    const lines = ["Коды для сдачи работ (Группа 1РУП8):"];
    for (const [st, item] of Object.entries(teacherSession.tokens)) {
      lines.push(`${st}: ${item.token} ${item.used ? "(Сдано)" : ""}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setTeacherSuccess("Список кодов скопирован в буфер обмена");
      setTimeout(() => setTeacherSuccess(null), 3000);
    } catch {
      setTeacherError("Не удалось скопировать");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 КБ";
    const k = 1024;
    const sizes = ["Б", "КБ", "МБ", "ГБ"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
  };

  const filteredSubmissions = submissions.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      item.student.toLowerCase().includes(q) ||
      item.filename.toLowerCase().includes(q) ||
      item.task.toLowerCase().includes(q)
    );
  });

  const isFormValid = Boolean(
    student && task && file && (!tokensActive || token.trim().length >= 4) && !validationError
  );

  return (
    <main className="max-w-xl mx-auto px-4 py-8 sm:py-12 flex flex-col gap-5">
      {/* 1. ЧИСТЫЙ МИНИМАЛИСТИЧНЫЙ ХЕДЕР */}
      <header className="flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">
            LabDrop
          </span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
            1РУП8
          </span>
          {tokensActive && (
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                tokensLocked
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                  : "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25"
              }`}
            >
              <KeyRound className="w-2.5 h-2.5" />
              {tokensLocked ? "Прием закрыт" : "По токенам"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/5 text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Онлайн
          </div>

          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 transition-colors"
            title="Сменить тему"
            aria-label="Сменить тему"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </header>

      {/* 2. ОСНОВНАЯ КАРТОЧКА СДАЧИ */}
      {!submittedData ? (
        <section className="glass-panel p-5 sm:p-7 flex flex-col gap-5">
          {/* Скачивание задания к уроку */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                Текущее задание: zadanie_current.pdf
              </span>
            </div>

            <a
              href="/tasks/zadanie_current.pdf"
              download="zadanie_current.pdf"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/15 transition-all shrink-0 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Скачать</span>
            </a>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Honeypot поле для защиты от ботов */}
            <input
              type="text"
              name="middle_name_check"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
            />

            {/* Выбор студента и номера работы */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="studentSelect" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Студент <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="studentSelect"
                    value={student}
                    onChange={(e) => setStudent(e.target.value)}
                    required
                    className="glass-input w-full h-10 px-3 pr-8 text-xs sm:text-sm appearance-none outline-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-400">
                      — Выберите себя —
                    </option>
                    {STUDENTS_1RUP8.map((name) => (
                      <option key={name} value={name} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="taskSelect" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Практическая работа <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="taskSelect"
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    required
                    className="glass-input w-full h-10 px-3 pr-8 text-xs sm:text-sm appearance-none outline-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-400">
                      — Номер работы —
                    </option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={String(num)} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        Практическая №{num}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Поле одноразового кода (если активировано преподавателем) */}
            {tokensActive && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="tokenInput" className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    <span>Одноразовый код (от преподавателя)</span> <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">4 цифры</span>
                </div>
                <input
                  id="tokenInput"
                  type="text"
                  maxLength={6}
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\s+/g, ""))}
                  placeholder="Например, 4819"
                  className="glass-input w-full h-10 px-3 text-xs sm:text-sm font-mono tracking-widest text-center"
                  required
                />
              </div>
            )}

            {/* Зона загрузки файла */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Файл работы <span className="text-rose-500">*</span>
              </label>

              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !file && fileInputRef.current?.click()}
                className={`glass-dropzone p-5 sm:p-6 text-center cursor-pointer ${
                  isDragging ? "active" : ""
                } ${validationError ? "border-rose-400/60 bg-rose-500/5" : ""}`}
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
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-300">
                      <UploadCloud className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
                        Перетащите файл сюда или{" "}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="text-teal-600 dark:text-teal-400 font-semibold underline hover:opacity-80"
                        >
                          выберите
                        </button>
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        .docx, .pdf, .py, .zip, .rar, .txt (до 50 МБ)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2.5 text-left overflow-hidden">
                      <div className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 font-mono text-[11px] font-bold border border-teal-500/20">
                        {file.name.split(".").pop()?.toUpperCase() || "FILE"}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-xs">
                          {file.name}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{formatBytes(file.size)}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                            <FileCheck2 className="w-3 h-3" /> Готов
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={clearFile}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                      title="Удалить"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Сообщение об ошибке */}
              {validationError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-200 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Кнопка отправки */}
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting || tokensLocked}
              className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                isFormValid && !isSubmitting && !tokensLocked
                  ? "btn-cta cursor-pointer"
                  : "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-slate-300/50 dark:border-white/5 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Отправка...</span>
                </>
              ) : tokensLocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Прием закрыт преподавателем</span>
                </>
              ) : (
                <>
                  <span>Сдать работу</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </section>
      ) : (
        /* 3. КВИТАНЦИЯ ОБ УСПЕШНОЙ СДАЧЕ */
        <section className="glass-panel p-6 sm:p-7 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            Работа успешно принята
          </h2>

          <div className="w-full max-w-sm bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 my-4 flex flex-col gap-2 text-left text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400">Студент:</span>
              <strong className="text-slate-900 dark:text-white">{submittedData.student}</strong>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400">Задание:</span>
              <strong className="text-slate-900 dark:text-white">{submittedData.task}</strong>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400">Сохранено как:</span>
              <div className="flex items-center gap-1.5">
                <code className="font-mono text-[11px] text-teal-700 dark:text-teal-300 bg-teal-500/10 px-1.5 py-0.5 rounded">
                  {submittedData.filename}
                </code>
                <button
                  type="button"
                  onClick={handleCopyFilename}
                  className="p-1 rounded bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/15"
                  title="Скопировать имя"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400">Время:</span>
              <span className="font-mono text-slate-900 dark:text-white">{submittedData.time}</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-slate-500 dark:text-slate-400">Размер:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{submittedData.size_kb}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetForm}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all"
          >
            Сдать еще одну работу
          </button>
        </section>
      )}

      {/* 4. МИНИМАЛИСТИЧНАЯ СТРОКА ЖУРНАЛА И КНОПКА ТОКЕНОВ */}
      <section className="glass-panel p-3.5 sm:p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span>Сдано:</span>
            <strong className="text-slate-900 dark:text-white font-semibold">{stats.unique_students}</strong>
            <span className="text-slate-400 dark:text-slate-500">из {stats.group_size} ({stats.percent}%)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowMonitor(!showMonitor)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 transition-colors"
            >
              <span>{showMonitor ? "Скрыть" : "Список"}</span>
              {showMonitor ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <a
              href="/api/download-log"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
              title="Скачать журнал сдачи"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>CSV</span>
            </a>

            {/* Кнопка входа в панель токенов преподавателя */}
            <button
              onClick={() => setShowTeacherModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-white/5 hover:bg-teal-500/10 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 border border-slate-200 dark:border-white/10 transition-colors"
              title="Панель преподавателя (Токены)"
            >
              <KeyRound className="w-3 h-3 text-teal-600 dark:text-teal-400" />
              <span>Коды</span>
            </button>
          </div>
        </div>

        {/* Раскрывающийся список сданных работ */}
        {showMonitor && (
          <div className="pt-2.5 border-t border-slate-200/80 dark:border-white/5 flex flex-col gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по фамилии..."
                className="glass-input w-full h-8 pl-8 pr-2.5 text-xs outline-none"
              />
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10 max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10 sticky top-0 font-medium">
                  <tr>
                    <th className="py-1.5 px-2.5">Студент</th>
                    <th className="py-1.5 px-2.5">Работа</th>
                    <th className="py-1.5 px-2.5">Файл</th>
                    <th className="py-1.5 px-2.5 text-right">Время</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {filteredSubmissions.length > 0 ? (
                    filteredSubmissions.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                        <td className="py-1.5 px-2.5 font-medium text-slate-900 dark:text-white">
                          {item.student}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-600 dark:text-slate-300">
                          {item.task}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-teal-700 dark:text-teal-300 truncate max-w-[150px]">
                          {item.filename}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-400 font-mono">
                          {item.datetime.slice(11, 16)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        {searchQuery ? "Не найдено" : "Сданных работ пока нет"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 5. МОДАЛЬНОЕ ОКНО ПРЕПОДАВАТЕЛЯ (УПРАВЛЕНИЕ ТОКЕНАМИ) */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg p-5 sm:p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Управление токенами сдачи
                </h3>
              </div>
              <button
                onClick={() => setShowTeacherModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Авторизация по PIN преподавателя */}
            {!isTeacherAuthed ? (
              <form onSubmit={handleTeacherAuth} className="flex flex-col gap-3 py-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Введите пароль преподавателя для доступа к генерации и просмотру кодов:
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={teacherPin}
                    onChange={(e) => setTeacherPin(e.target.value)}
                    placeholder="PIN преподавателя (1rup8)"
                    className="glass-input flex-1 h-10 px-3 text-sm outline-none"
                    autoFocus
                  />
                  <button type="submit" className="btn-cta px-4 rounded-xl text-xs font-semibold">
                    Войти
                  </button>
                </div>
                {teacherError && (
                  <p className="text-xs text-rose-500">{teacherError}</p>
                )}
              </form>
            ) : (
              /* Панель управления после авторизации */
              <div className="flex flex-col gap-4">
                {/* Статус сессии и кнопки управления */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Статус:</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full ${
                        teacherSession?.is_active
                          ? teacherSession?.is_locked
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-teal-500/10 text-teal-700 dark:text-teal-300"
                          : "bg-slate-100 dark:bg-white/10 text-slate-500"
                      }`}
                    >
                      {!teacherSession?.is_active
                        ? "Не активна (свободный режим)"
                        : teacherSession?.is_locked
                        ? "Заблокирована (прием закрыт)"
                        : "Активна"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => executeTeacherAction("toggle_lock")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 transition-colors"
                      title={teacherSession?.is_locked ? "Открыть прием" : "Закрыть прием"}
                    >
                      {teacherSession?.is_locked ? <Unlock className="w-3 h-3 text-emerald-500" /> : <Lock className="w-3 h-3 text-amber-500" />}
                      <span>{teacherSession?.is_locked ? "Открыть" : "Закрыть"}</span>
                    </button>

                    <button
                      onClick={copyTokensToClipboard}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 transition-colors"
                      title="Скопировать список в буфер"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Скопировать</span>
                    </button>

                    <button
                      onClick={() => setShowProjectorMode(!showProjectorMode)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-colors"
                      title="Режим проектора на экран кабинета"
                    >
                      <Monitor className="w-3 h-3" />
                      <span>Проектор</span>
                    </button>
                  </div>
                </div>

                {/* Главная кнопка генерации */}
                <div className="flex gap-2">
                  <button
                    onClick={() => executeTeacherAction("generate_all")}
                    className="btn-cta flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Сгенерировать новые коды на пару</span>
                  </button>

                  <button
                    onClick={() => executeTeacherAction("reset")}
                    className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-rose-500/10 text-slate-600 dark:text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-white/10 text-xs font-medium transition-colors"
                    title="Сбросить в свободный режим без кодов"
                  >
                    Сброс
                  </button>
                </div>

                {teacherSuccess && (
                  <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">{teacherSuccess}</p>
                )}
                {teacherError && (
                  <p className="text-xs text-rose-500 font-medium">{teacherError}</p>
                )}

                {/* Сетка кодов (Режим проектора или обычный список) */}
                {teacherSession?.tokens && (
                  <div className="flex flex-col gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Коды студентов группы 1РУП8 ({Object.keys(teacherSession.tokens).length} чел.):
                    </div>

                    <div
                      className={`grid gap-2 max-h-72 overflow-y-auto pr-1 ${
                        showProjectorMode ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"
                      }`}
                    >
                      {STUDENTS_1RUP8.map((stName) => {
                        const item = teacherSession.tokens[stName];
                        if (!item) return null;

                        return (
                          <div
                            key={stName}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                              item.used
                                ? "bg-emerald-500/5 border-emerald-500/20 text-slate-500 dark:text-slate-400"
                                : "bg-slate-50/70 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                            }`}
                          >
                            <div className="overflow-hidden">
                              <div className="text-xs font-medium truncate">{stName}</div>
                              <div className="text-[10px] text-slate-400">
                                {item.used ? `Сдал (${item.used_at})` : "Ожидает"}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                                  item.used
                                    ? "bg-slate-200 dark:bg-white/10 line-through text-slate-400"
                                    : "bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20"
                                }`}
                              >
                                {item.token}
                              </span>

                              {/* Кнопка перевыпуска кода для этого студента */}
                              <button
                                onClick={() => executeTeacherAction("regenerate_one", stName)}
                                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                                title={`Перевыпустить код для ${stName}`}
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
