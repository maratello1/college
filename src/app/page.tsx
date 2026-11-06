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
  ShieldCheck,
  ChevronDown,
  ChevronUp,
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
  const [showMonitor, setShowMonitor] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Инициализация темы
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

    if (selectedFile.size === 0) {
      setValidationError("Файл не содержит данных (0 байт)");
      return false;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setValidationError("Размер файла превышает допустимые 50 МБ");
      return false;
    }

    const nameLower = selectedFile.name.toLowerCase();
    for (const badExt of DANGEROUS_EXTENSIONS) {
      if (nameLower.endsWith(badExt)) {
        setValidationError(
          `Файлы "${badExt}" заблокированы из соображений безопасности. Разрешены: ${ALLOWED_EXTENSIONS.join(", ")}`
        );
        return false;
      }
    }

    const dotIndex = nameLower.lastIndexOf(".");
    const ext = dotIndex !== -1 ? nameLower.slice(dotIndex) : "";
    const isAllowed = ALLOWED_EXTENSIONS.some((allowed) => allowed === ext);

    if (!isAllowed) {
      setValidationError(
        `Формат "${ext || "без расширения"}" не поддерживается. Разрешены: ${ALLOWED_EXTENSIONS.join(", ")}`
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
      setCopyFeedback("Скопировано");
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
    <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12 flex flex-col gap-6">
      {/* 1. МИНИМАЛИСТИЧНЫЙ ХЕДЕР (БЕЗ ТЯЖЕЛЫХ БОКСОВ) */}
      <header className="flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 dark:bg-teal-400/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm">
            LD
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                LabDrop
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                1РУП8
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Сдача практических работ в кабинете колледжа
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/5 text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Сервер активен
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 transition-colors"
            title="Переключить тему оформления"
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

      {/* 2. ЕДИНАЯ ГЛАВНАЯ СТЕКЛЯННАЯ КАРТОЧКА (БЕЗ ДРОБЛЕНИЯ НА 5 БОКСОВ) */}
      {!submittedData ? (
        <section className="glass-panel p-6 sm:p-8 flex flex-col gap-6">
          {/* Интегрированная строка скачивания задания */}
          <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Задание к текущему уроку:{" "}
                <span className="font-semibold text-slate-900 dark:text-white">zadanie_current.pdf</span>
                <span className="hidden sm:inline text-slate-400 dark:text-slate-500"> (без входа в мессенджер Макс)</span>
              </div>
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
                <label htmlFor="studentSelect" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Студент группы 1РУП8 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="studentSelect"
                    value={student}
                    onChange={(e) => setStudent(e.target.value)}
                    required
                    className="glass-input w-full h-11 px-3.5 pr-10 text-sm appearance-none outline-none cursor-pointer"
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
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="taskSelect" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Номер практической работы <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="taskSelect"
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    required
                    className="glass-input w-full h-11 px-3.5 pr-10 text-sm appearance-none outline-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-400">
                      — Выберите номер —
                    </option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={String(num)} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        Практическая работа №{num}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Зона загрузки файла */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Файл работы <span className="text-rose-500">*</span>
              </label>

              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !file && fileInputRef.current?.click()}
                className={`glass-dropzone p-6 sm:p-7 text-center cursor-pointer ${
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
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-300">
                      <UploadCloud className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
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
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        docx, doc, pdf, py, zip, rar, txt • до 50 МБ
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-3 text-left overflow-hidden">
                      <div className="px-2.5 py-1 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 font-mono text-xs font-bold border border-teal-500/20">
                        {file.name.split(".").pop()?.toUpperCase() || "FILE"}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[240px] sm:max-w-xs">
                          {file.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>{formatBytes(file.size)}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <FileCheck2 className="w-3.5 h-3.5" /> Готов
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={clearFile}
                      className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
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

            {/* Подсказка автоименования */}
            <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              Имя файла на сервере сформируется автоматически:{" "}
              <span className="font-mono text-slate-700 dark:text-slate-300">
                1RUP8_Фамилия_Работа№.ext
              </span>
            </div>

            {/* Кнопка отправки */}
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                isFormValid && !isSubmitting
                  ? "btn-cta cursor-pointer"
                  : "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-slate-300/50 dark:border-white/5 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Отправка...</span>
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
        /* 3. ЭКРАН ПОДТВЕРЖДЕНИЯ СДАЧИ */
        <section className="glass-panel p-6 sm:p-8 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Работа успешно принята
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Зарегистрирована в журнале преподавателя.
          </p>

          <div className="w-full max-w-md bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-4 my-5 flex flex-col gap-2.5 text-left text-xs sm:text-sm">
            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400">Студент:</span>
              <strong className="text-slate-900 dark:text-white font-medium">{submittedData.student}</strong>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400">Задание:</span>
              <strong className="text-slate-900 dark:text-white font-medium">{submittedData.task}</strong>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400">Имя на сервере:</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs text-teal-700 dark:text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded">
                  {submittedData.filename}
                </code>
                <button
                  type="button"
                  onClick={handleCopyFilename}
                  className="px-2 py-0.5 rounded bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/15"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-white/5">
              <span className="text-slate-500 dark:text-slate-400">Время сдачи:</span>
              <span className="font-mono font-medium text-slate-900 dark:text-white">{submittedData.time}</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-slate-500 dark:text-slate-400">Размер:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{submittedData.size_kb}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetForm}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all"
          >
            Сдать еще одну работу
          </button>
        </section>
      )}

      {/* 4. АККУРАТНЫЙ ЖУРНАЛ / СВОДКА (БЕЗ ПЕРЕГРУЗКИ) */}
      <section className="glass-panel p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">Журнал 1РУП8:</span>
            <span className="text-slate-500 dark:text-slate-400">
              Сдали <strong className="text-teal-700 dark:text-teal-300">{stats.unique_students}</strong> из {stats.group_size} ({stats.percent}%)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMonitor(!showMonitor)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 transition-colors"
            >
              <span>{showMonitor ? "Скрыть список" : "Показать список"}</span>
              {showMonitor ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <a
              href="/api/download-log"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>CSV</span>
            </a>
          </div>
        </div>

        {/* Раскрывающийся список сданных работ */}
        {showMonitor && (
          <div className="pt-3 border-t border-slate-200/80 dark:border-white/5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по фамилии..."
                  className="glass-input w-full h-9 pl-9 pr-3 text-xs outline-none"
                />
              </div>

              <button
                onClick={handleRefresh}
                className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                title="Обновить"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Студент</th>
                    <th className="py-2.5 px-3">Задание</th>
                    <th className="py-2.5 px-3">Файл на сервере</th>
                    <th className="py-2.5 px-3">Время</th>
                    <th className="py-2.5 px-3 text-right">Размер</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {filteredSubmissions.length > 0 ? (
                    filteredSubmissions.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                          {item.student}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                          {item.task}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-teal-700 dark:text-teal-300">
                          {item.filename}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono">
                          {item.datetime.slice(11, 16)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 dark:text-slate-400">
                          {item.size_kb} КБ
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        {searchQuery ? "Ничего не найдено" : "Сданных работ пока нет"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 5. АККУРАТНЫЙ ФУТЕР */}
      <footer className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 flex flex-col gap-1">
        <p>Авторы проекта: Савченков Артем и Алиев Марат (группа 1РУП8)</p>
        <p className="text-[11px] text-slate-400/80">Компьютерный кабинет колледжа • Без личных аккаунтов</p>
      </footer>
    </main>
  );
}
