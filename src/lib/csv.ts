import fs from "fs";
import path from "path";

export interface SubmissionEntry {
  datetime: string;
  student: string;
  task: string;
  filename: string;
  size_kb: string;
}

const ROOT_DIR = process.cwd();
export const CSV_PATH = path.join(ROOT_DIR, "submissions_log.csv");
export const UPLOADS_DIR = path.join(ROOT_DIR, "uploads");

// Убеждаемся в наличии каталога uploads
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Убеждаемся в наличии submissions_log.csv
if (!fs.existsSync(CSV_PATH)) {
  fs.writeFileSync(
    CSV_PATH,
    "\ufeffДата и время,Студент,Номер работы,Имя файла,Размер (КБ)\n",
    { encoding: "utf-8" }
  );
}

/**
 * Strix Vector 3: Нейтрализация DDE / CSV-инъекций формул для Excel
 */
export function sanitizeCsvField(value: string): string {
  const s = String(value || "").trim();
  if (s && ["=", "+", "-", "@", "\t", "\r"].includes(s[0])) {
    return `'${s}`;
  }
  return s;
}

/**
 * Добавление записи о сдаче в журнал
 */
export async function appendSubmissionToCsv(entry: SubmissionEntry): Promise<void> {
  const safeDt = sanitizeCsvField(entry.datetime);
  const safeStudent = sanitizeCsvField(entry.student);
  const safeTask = sanitizeCsvField(entry.task);
  const safeFilename = sanitizeCsvField(entry.filename);
  const safeSize = sanitizeCsvField(entry.size_kb);

  const row = `"${safeDt}","${safeStudent}","${safeTask}","${safeFilename}","${safeSize}"\n`;

  await fs.promises.appendFile(CSV_PATH, row, { encoding: "utf-8" });
}

/**
 * Чтение списка сданных работ
 */
export async function readSubmissionsFromCsv(): Promise<SubmissionEntry[]> {
  if (!fs.existsSync(CSV_PATH)) {
    return [];
  }

  const raw = await fs.promises.readFile(CSV_PATH, { encoding: "utf-8" });
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const submissions: SubmissionEntry[] = [];

  // Пропускаем заголовок
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Простой парсинг CSV с кавычками
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (matches && matches.length >= 5) {
      const clean = matches.map((m) => m.replace(/^"|"$/g, "").replace(/^'/, ""));
      submissions.push({
        datetime: clean[0],
        student: clean[1],
        task: clean[2],
        filename: clean[3],
        size_kb: clean[4],
      });
    }
  }

  return submissions.reverse();
}
