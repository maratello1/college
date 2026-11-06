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
  const [uploadProgress, setUploadProgress] = useState<number>(0);

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
      setValidationError("Файл не содержит данных");
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
    setUploadProgress(25);

    const formData = new FormData();
    formData.append("student", student);
    formData.append("task", task);
    formData.append("file", file);

    try {
      setUploadProgress(65);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      setUploadProgress(100);
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
      setUploadProgress(0);
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
    <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* 1. ШАПКА СЕРВИСА */}
      <header className="glass-panel p-6 sm:p-7 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/40 border border-white/20 flex items-center justify-center text-accent-cyan shadow-lg shadow-blue-500/20">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-400 bg-clip-text text-transparent">
                  LabDrop
                </h1>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  1РУП8
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Strix SecOps
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                Сдача практических работ в кабинете колледжа. Без входа в личные аккаунты.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Сервер активен
            </div>

            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Переключить тему оформления"
              aria-label="Сменить тему"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-400">
          <div>
            Авторы: <strong className="text-slate-200">Алиев Марат</strong> (бэкенд) и{" "}
            <strong className="text-slate-200">Савченков Артем</strong> (фронтенд)
          </div>
          <div className="text-accent-cyan">Компьютерный класс • Группа 1РУП8</div>
        </div>
      </header>

      {/* 2. КАРТОЧКА ЗАДАНИЯ К УРОКУ */}
      <section className="glass-panel p-5 sm:p-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 min-w-[280px]">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-accent-cyan shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent-cyan bg-cyan-500/15 px-2 py-0.5 rounded">
              Текущий урок
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 mt-1">
              Задание к сегодняшнему занятию
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Скачайте файл с методичкой в 1 клик без входа в мессенджер Макс (российский мессенджер)
            </p>
          </div>
        </div>

        <a
          href="/tasks/zadanie_current.pdf"
          download="zadanie_current.pdf"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 transition-all shadow-md shrink-0 w-full sm:w-auto"
        >
          <Download className="w-4 h-4 text-blue-600" />
          <span>Скачать задание (.pdf)</span>
        </a>
      </section>

      {/* 3. ОСНОВНАЯ ФОРМА СДАЧИ РАБОТЫ */}
      {!submittedData ? (
        <section className="glass-panel p-6 sm:p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
                Форма сдачи выполненной работы
              </h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-500/15 text-accent-cyan border border-cyan-500/25">
                Сдача за 20 секунд
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Файл автоматически сохранится по стандарту колледжа:{" "}
              <code className="text-xs font-mono text-accent-cyan bg-white/5 px-2 py-0.5 rounded border border-white/10">
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
                <label htmlFor="studentSelect" className="text-sm font-semibold text-slate-200">
                  Студент группы 1РУП8 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="studentSelect"
                    value={student}
                    onChange={(e) => setStudent(e.target.value)}
                    required
                    className="glass-input w-full h-12 px-4 pr-10 rounded-xl text-sm appearance-none outline-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-slate-900 text-slate-400">
                      — Выберите свою фамилию —
                    </option>
                    {STUDENTS_1RUP8.map((name) => (
                      <option key={name} value={name} className="bg-slate-900 text-slate-100">
                        {name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="taskSelect" className="text-sm font-semibold text-slate-200">
                  Номер практической работы <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="taskSelect"
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    required
                    className="glass-input w-full h-12 px-4 pr-10 rounded-xl text-sm appearance-none outline-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-slate-900 text-slate-400">
                      — Выберите номер работы —
                    </option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={String(num)} className="bg-slate-900 text-slate-100">
                        Практическая работа №{num}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Drag and Drop Зона загрузки файла */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-200">
                Файл с выполненным заданием <span className="text-rose-500">*</span>
              </label>

              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !file && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-accent-cyan bg-cyan-500/10 scale-[1.01]"
                    : validationError
                    ? "border-rose-500/50 bg-rose-500/5"
                    : "border-white/15 bg-slate-950/30 hover:border-accent-cyan/60 hover:bg-cyan-500/5"
                }`}
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
                    <div className="w-14 h-14 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-accent-cyan">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-medium text-slate-200">
                        Перетащите файл сюда или{" "}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="text-accent-cyan font-bold underline hover:text-cyan-300"
                        >
                          выберите на компьютере
                        </button>
                      </p>
                      <div className="flex items-center justify-center gap-1.5 flex-wrap mt-2">
                        {ALLOWED_EXTENSIONS.map((ext) => (
                          <span
                            key={ext}
                            className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300"
                          >
                            {ext}
                          </span>
                        ))}
                        <span className="text-xs text-slate-400 ml-1">• до 50 МБ</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3.5 bg-slate-900/80 border border-white/15 rounded-xl">
                    <div className="flex items-center gap-3.5 text-left overflow-hidden">
                      <div className="px-3 py-2 rounded-lg bg-cyan-500/20 text-accent-cyan font-mono text-xs font-bold border border-cyan-500/30">
                        {file.name.split(".").pop()?.toUpperCase() || "FILE"}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-sm font-semibold text-slate-100 truncate max-w-[280px] sm:max-w-md">
                          {file.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="font-mono">{formatBytes(file.size)}</span>
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <FileCheck2 className="w-3.5 h-3.5" /> Готов к отправке
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={clearFile}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Выбрать другой файл"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Прогресс-бар загрузки */}
              {isSubmitting && (
                <div className="flex flex-col gap-1.5 mt-2">
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Передача файла на сервер...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}

              {/* Ошибка валидации */}
              {validationError && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm mt-2">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Кнопка отправки */}
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-lg ${
                isFormValid && !isSubmitting
                  ? "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-blue-500/25 hover:shadow-cyan-500/35 cursor-pointer"
                  : "bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Отправка...</span>
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
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-extrabold text-slate-100">Работа успешно принята!</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-md">
            Файл зарегистрирован в журнале преподавателя и сохранен на сервере кабинета.
          </p>

          <div className="w-full max-w-lg bg-slate-950/40 border border-white/10 rounded-2xl p-5 my-6 flex flex-col gap-3 text-left">
            <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
              <span className="text-slate-400">Студент:</span>
              <strong className="text-slate-100">{submittedData.student}</strong>
            </div>

            <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
              <span className="text-slate-400">Задание:</span>
              <strong className="text-slate-100">{submittedData.task}</strong>
            </div>

            <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
              <span className="text-slate-400">Имя на сервере:</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs text-accent-cyan bg-cyan-500/10 px-2.5 py-1 rounded border border-cyan-500/20">
                  {submittedData.filename}
                </code>
                <button
                  type="button"
                  onClick={handleCopyFilename}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copyFeedback}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
              <span className="text-slate-400">Время сдачи:</span>
              <span className="font-mono text-accent-cyan font-bold">{submittedData.time}</span>
            </div>

            <div className="flex justify-between items-center text-sm py-1">
              <span className="text-slate-400">Размер:</span>
              <span className="text-slate-200">{submittedData.size_kb}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetForm}
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 font-semibold text-sm transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Сдать еще одну работу</span>
          </button>
        </section>
      )}

      {/* 5. МОНИТОР СТАРОСТЫ И ПРЕПОДАВАТЕЛЯ (DASHBOARD) */}
      <section className="glass-panel p-6 sm:p-7">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Монитор сдачи работ (Группа 1РУП8)</h3>
              <p className="text-xs text-slate-400">Сводка для старосты и преподавателя на текущей паре</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Обновить</span>
            </button>

            <a
              href="/api/download-log"
              className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Экспорт в Excel (.csv)</span>
            </a>
          </div>
        </div>

        {/* 4 Виджета статистики */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-5">
          <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 text-left">
            <div className="text-xs text-slate-400 uppercase font-semibold">Всего сдач</div>
            <div className="text-2xl font-extrabold font-mono text-slate-100 my-0.5">
              {stats.total_submissions}
            </div>
            <div className="text-[11px] text-slate-500">файлов принято</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 text-left">
            <div className="text-xs text-slate-400 uppercase font-semibold">Сдали студентов</div>
            <div className="text-2xl font-extrabold font-mono text-slate-100 my-0.5">
              {stats.unique_students} / {stats.group_size}
            </div>
            <div className="text-[11px] text-slate-500">уникальных авторов</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 text-left">
            <div className="text-xs text-slate-400 uppercase font-semibold">Охват группы</div>
            <div className="text-2xl font-extrabold font-mono text-accent-cyan my-0.5">
              {stats.percent}%
            </div>
            <div className="text-[11px] text-slate-500">сдали хотя бы 1 работу</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 text-left">
            <div className="text-xs text-slate-400 uppercase font-semibold">Безопасность</div>
            <div className="text-2xl font-extrabold font-mono text-emerald-400 my-0.5">
              100%
            </div>
            <div className="text-[11px] text-slate-500">Strix SecOps Verified</div>
          </div>
        </div>

        {/* Прогресс-бар охвата */}
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(stats.percent, 100)}%` }}
          />
        </div>

        {/* Поиск и фильтрация */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по фамилии или файлу..."
              className="glass-input w-full h-10 pl-10 pr-4 rounded-lg text-xs sm:text-sm outline-none"
            />
          </div>

          <div className="relative">
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              className="glass-input h-10 px-3.5 pr-8 rounded-lg text-xs sm:text-sm appearance-none outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">Все практические</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)} className="bg-slate-900">
                  Работа №{n}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Таблица журнала */}
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/30">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-slate-400 text-xs font-semibold">
                <th className="p-3 whitespace-nowrap">Время</th>
                <th className="p-3">Студент</th>
                <th className="p-3 whitespace-nowrap">Задание</th>
                <th className="p-3">Имя файла</th>
                <th className="p-3 whitespace-nowrap">Размер</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {filteredSubmissions.length > 0 ? (
                filteredSubmissions.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                    <td className="p-3 font-mono text-xs whitespace-nowrap text-slate-400">
                      {row.datetime}
                    </td>
                    <td className="p-3 font-semibold text-slate-100">{row.student}</td>
                    <td className="p-3 whitespace-nowrap">{row.task}</td>
                    <td className="p-3 font-mono text-xs text-accent-cyan">
                      <span className="bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        {row.filename}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {row.size_kb}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                    {submissions.length === 0
                      ? "Работ пока не сдано. Сдайте первую работу через форму выше!"
                      : "Ничего не найдено по вашему запросу."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. ПОДВАЛ */}
      <footer className="glass-panel p-5 flex items-center justify-between flex-wrap gap-3 text-xs text-slate-400">
        <div>
          © 2026 LabDrop | 1РУП8. Сдача практических работ без паролей.
        </div>
        <div className="text-slate-500">
          Стек: TypeScript • Next.js 15 • React 19 • Tailwind CSS • Strix SecOps
        </div>
      </footer>
    </main>
  );
}
