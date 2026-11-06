import { NextRequest, NextResponse } from "next/server";
import {
  getTokensState,
  generateAllTokens,
  regenerateSingleToken,
  toggleSessionLock,
  resetTokensSession,
  TEACHER_DEFAULT_PIN,
} from "../../../lib/tokens";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pin = searchParams.get("pin");

    const state = getTokensState();

    // Если преподаватель ввел правильный мастер-пин — отдаем полные данные с кодами
    if (pin === TEACHER_DEFAULT_PIN) {
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
    });
  } catch (error) {
    console.error("GET /api/tokens error:", error);
    return NextResponse.json({ status: "error", message: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin, action, student } = body;

    if (pin !== TEACHER_DEFAULT_PIN) {
      return NextResponse.json(
        { status: "error", message: "Неверный PIN преподавателя" },
        { status: 403 }
      );
    }

    if (action === "verify_pin") {
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
