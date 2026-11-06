import { NextRequest, NextResponse } from "next/server";
import {
  getTokensState,
  generateAllTokens,
  regenerateSingleToken,
  toggleSessionLock,
  setSessionTimer,
  resetTokensSession,
  TEACHER_DEFAULT_PIN,
  TEACHER_DEFAULT_LOGIN,
  TEACHER_DEFAULT_PASSWORD,
} from "../../../lib/tokens";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pin = searchParams.get("pin");
    const login = searchParams.get("login");
    const password = searchParams.get("password");

    const state = getTokensState();

    const isAuthed =
      pin === TEACHER_DEFAULT_PIN ||
      (login &&
        (login.toLowerCase() === TEACHER_DEFAULT_LOGIN || login.toLowerCase() === "admin") &&
        password === TEACHER_DEFAULT_PASSWORD);

    // Если преподаватель ввел правильные реквизиты — отдаем полные данные с кодами
    if (isAuthed) {
      return NextResponse.json({
        status: "ok",
        authenticated: true,
        session: state,
      });
    }

    // Для обычных студентов отдаем только факт активности и блокировки (без кодов!)
    return NextResponse.json({
      status: "ok",
      authenticated: false,
      is_active: state.is_active,
      is_locked: state.is_locked,
      deadline_timestamp: state.deadline_timestamp || null,
    });
  } catch (error) {
    console.error("GET /api/tokens error:", error);
    return NextResponse.json({ status: "error", message: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { login, password, pin, action, student } = body;

    const isLoginValid =
      !login ||
      login.trim().toLowerCase() === TEACHER_DEFAULT_LOGIN ||
      login.trim().toLowerCase() === "admin" ||
      login.trim().toLowerCase() === "преподаватель";

    const isPassValid =
      password === TEACHER_DEFAULT_PASSWORD ||
      pin === TEACHER_DEFAULT_PIN ||
      password === TEACHER_DEFAULT_PIN;

    if (!isLoginValid || !isPassValid) {
      return NextResponse.json(
        { status: "error", message: "Неверный логин или пароль преподавателя" },
        { status: 403 }
      );
    }

    if (action === "verify_pin" || action === "login") {
      const state = getTokensState();
      return NextResponse.json({
        status: "ok",
        message: "Авторизован",
        session: state,
      });
    }

    if (action === "generate_all") {
      const newState = generateAllTokens();
      return NextResponse.json({
        status: "ok",
        message: "Коды для всех студентов успешно сгенерированы",
        session: newState,
      });
    }

    if (action === "regenerate_one") {
      if (!student) {
        return NextResponse.json(
          { status: "error", message: "Не указано имя студента" },
          { status: 400 }
        );
      }
      regenerateSingleToken(student);
      const updatedState = getTokensState();
      return NextResponse.json({
        status: "ok",
        message: `Новый код для ${student} сгенерирован`,
        session: updatedState,
      });
    }

    if (action === "toggle_lock") {
      const updatedState = toggleSessionLock();
      return NextResponse.json({
        status: "ok",
        message: updatedState.is_locked ? "Прием заблокирован" : "Прием разблокирован",
        session: updatedState,
      });
    }

    if (action === "set_timer") {
      const minutes = body.minutes !== undefined ? Number(body.minutes) : null;
      const updatedState = setSessionTimer(minutes);
      return NextResponse.json({
        status: "ok",
        message: minutes ? `Таймер установлен на ${minutes} мин.` : "Таймер отменен",
        session: updatedState,
      });
    }

    if (action === "reset") {
      const cleared = resetTokensSession();
      return NextResponse.json({
        status: "ok",
        message: "Сессия токенов сброшена (свободный режим)",
        session: cleared,
      });
    }

    return NextResponse.json(
      { status: "error", message: "Неизвестное действие" },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/tokens error:", error);
    return NextResponse.json({ status: "error", message: "Ошибка сервера" }, { status: 500 });
  }
}
