import fs from "fs";
import path from "path";
import { STUDENTS_1RUP8 } from "./constants";

export const TEACHER_DEFAULT_PIN = "1rup8";

const TOKENS_FILE = path.join(process.cwd(), "tokens.json");

export interface StudentTokenItem {
  token: string;
  used: boolean;
  used_at: string | null;
  task?: string | null;
  filename?: string | null;
}

export interface TokensSession {
  is_active: boolean;
  is_locked: boolean;
  created_at: string | null;
  tokens: Record<string, StudentTokenItem>;
}

function getRandomPin(): string {
  // 4-значный понятный пин-код (от 1000 до 9999)
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function getTokensState(): TokensSession {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const raw = fs.readFileSync(TOKENS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading tokens file:", err);
  }

  return {
    is_active: false,
    is_locked: false,
    created_at: null,
    tokens: {},
  };
}

export function saveTokensState(state: TokensSession): void {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing tokens file:", err);
  }
}

// 1. Генерация пачки кодов для всех студентов на урок
export function generateAllTokens(): TokensSession {
  const now = new Date();
  const timeStr = `${now.toLocaleDateString("ru-RU")} ${now.toLocaleTimeString("ru-RU")}`;
  
  const tokensRecord: Record<string, StudentTokenItem> = {};
  const usedPins = new Set<string>();

  for (const student of STUDENTS_1RUP8) {
    let pin = getRandomPin();
    while (usedPins.has(pin)) {
      pin = getRandomPin();
    }
    usedPins.add(pin);

    tokensRecord[student] = {
      token: pin,
      used: false,
      used_at: null,
      task: null,
      filename: null,
    };
  }

  const newState: TokensSession = {
    is_active: true,
    is_locked: false,
    created_at: timeStr,
    tokens: tokensRecord,
  };

  saveTokensState(newState);
  return newState;
}

// 2. Перевыпуск кода для одного конкретного студента
export function regenerateSingleToken(studentName: string): StudentTokenItem | null {
  const state = getTokensState();
  if (!state.is_active || !state.tokens[studentName]) {
    // Если сессия не создана, инициализируем ее
    const initialized = generateAllTokens();
    return initialized.tokens[studentName] || null;
  }

  // Собираем уже выданные пины, чтобы не дублировать
  const existingPins = new Set(Object.values(state.tokens).map((t) => t.token));
  let pin = getRandomPin();
  while (existingPins.has(pin)) {
    pin = getRandomPin();
  }

  state.tokens[studentName] = {
    token: pin,
    used: false,
    used_at: null,
    task: null,
    filename: null,
  };

  saveTokensState(state);
  return state.tokens[studentName];
}

// 3. Проверка и списание токена при сдаче
export function verifyAndConsumeToken(
  studentName: string,
  providedToken: string,
  taskName: string,
  filename: string
): { valid: boolean; error?: string } {
  const state = getTokensState();

  // Если сессия токенов вообще не активирована преподавателем — свободный режим
  if (!state.is_active) {
    return { valid: true };
  }

  // Если прием заблокирован («Замок урока»)
  if (state.is_locked) {
    return {
      valid: false,
      error: "Прием работ завершен преподавателем на текущий урок",
    };
  }

  const studentData = state.tokens[studentName];
  if (!studentData) {
    return {
      valid: false,
      error: `Студент "${studentName}" не найден в списке группы 1РУП8`,
    };
  }

  const cleanProvided = String(providedToken || "").trim();
  if (!cleanProvided) {
    return {
      valid: false,
      error: "Введите одноразовый код от преподавателя",
    };
  }

  if (studentData.token !== cleanProvided) {
    return {
      valid: false,
      error: "Неверный код для выбранного студента",
    };
  }

  if (studentData.used) {
    return {
      valid: false,
      error: `Этот код уже был использован (${studentData.used_at || "ранее"}). Попросите преподавателя выдать новый.`,
    };
  }

  // Списываем токен
  const now = new Date();
  studentData.used = true;
  studentData.used_at = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  studentData.task = taskName;
  studentData.filename = filename;

  saveTokensState(state);
  return { valid: true };
}

// 4. Блокировка/разблокировка сессии («Замок урока»)
export function toggleSessionLock(locked?: boolean): TokensSession {
  const state = getTokensState();
  if (!state.is_active) {
    return state;
  }

  state.is_locked = locked !== undefined ? locked : !state.is_locked;
  saveTokensState(state);
  return state;
}

// 5. Сброс сессии
export function resetTokensSession(): TokensSession {
  const newState: TokensSession = {
    is_active: false,
    is_locked: false,
    created_at: null,
    tokens: {},
  };
  saveTokensState(newState);
  return newState;
}
