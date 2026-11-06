import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  ALLOWED_EXTENSIONS,
  DANGEROUS_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from "../../../lib/constants";
import { appendSubmissionToCsv, UPLOADS_DIR } from "../../../lib/csv";
import { verifyAndConsumeToken } from "../../../lib/tokens";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // 1. Strix Vector 7: Honeypot Anti-Spam защита
    const honeypot = String(formData.get("middle_name_check") || "").trim();
    if (honeypot) {
      return NextResponse.json(
        { status: "error", message: "Подозрительная активность (Honeypot Triggered)" },
        { status: 400 }
      );
    }

    const studentRaw = String(formData.get("student") || "").trim();
    const taskRaw = String(formData.get("task") || "").trim();
    const file = formData.get("file") as File | null;

    // 2. Валидация полей студента и работы
    if (!studentRaw) {
      return NextResponse.json(
        { status: "error", message: "Выберите свою фамилию из списка группы" },
        { status: 400 }
      );
    }

    if (!taskRaw) {
      return NextResponse.json(
        { status: "error", message: "Выберите номер практической работы" },
        { status: 400 }
      );
    }

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { status: "error", message: "Файл не прикреплен" },
        { status: 400 }
      );
    }

    // 3. Валидация размера файла
    if (file.size === 0) {
      return NextResponse.json(
        { status: "error", message: "Файл не содержит данных" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { status: "error", message: "Размер файла превышает допустимые 50 МБ" },
        { status: 400 }
      );
    }

    // 4. Strix Vector 2: Проверка расширения файла на безопасность
    const originalName = file.name.toLowerCase().trim();

    for (const badExt of DANGEROUS_EXTENSIONS) {
      if (originalName.endsWith(badExt)) {
        return NextResponse.json(
          {
            status: "error",
            message: `Файлы типа ${badExt} запрещены политикой безопасности колледжа.`,
          },
          { status: 400 }
        );
      }
    }

    const dotIndex = originalName.lastIndexOf(".");
    const ext = dotIndex !== -1 ? originalName.slice(dotIndex) : "";

    const isAllowed = ALLOWED_EXTENSIONS.some((allowed) => allowed === ext);
    if (!isAllowed) {
      return NextResponse.json(
        {
          status: "error",
          message: `Формат ${ext || "без расширения"} недопустим. Разрешены: ${ALLOWED_EXTENSIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 5. Формирование имени файла по стандарту колледжа
    // Очищаем фамилию от недопустимых символов
    const surnameRaw = studentRaw.split(" ")[0] || "Студент";
    const safeSurname = surnameRaw.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\-]/g, "") || "Студент";

    const taskMatch = taskRaw.match(/\d+/);
    const taskNum = taskMatch ? taskMatch[0] : "1";

    const baseName = `1RUP8_${safeSurname}_Работа${taskNum}`;
    let finalFilename = `${baseName}${ext}`;
    let targetPath = path.join(UPLOADS_DIR, finalFilename);

    // 6. Защита от перезаписи (версионирование _v2, _v3)
    if (fs.existsSync(targetPath)) {
      let version = 2;
      while (true) {
        const candidate = `${baseName}_v${version}${ext}`;
        const candidatePath = path.join(UPLOADS_DIR, candidate);
        if (!fs.existsSync(candidatePath)) {
          finalFilename = candidate;
          targetPath = candidatePath;
          break;
        }
        version++;
      }
    }

    // 7. Проверка одноразового токена (если сессия токенов активна)
    const tokenRaw = String(formData.get("token") || "").trim();
    const tokenRes = verifyAndConsumeToken(studentRaw, tokenRaw, `Работа №${taskNum}`, finalFilename);
    if (!tokenRes.valid) {
      return NextResponse.json(
        { status: "error", message: tokenRes.error || "Ошибка проверки кода" },
        { status: 400 }
      );
    }

    // 8. Сохранение файла на диск
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(targetPath, buffer);

    // 9. Запись в CSV журнал
    const now = new Date();
    const timeShort = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const dtStr = `${now.toLocaleDateString("ru-RU")} ${now.toLocaleTimeString("ru-RU")}`;
    const sizeKb = (buffer.length / 1024).toFixed(1);

    await appendSubmissionToCsv({
      datetime: dtStr,
      student: studentRaw,
      task: `Работа №${taskNum}`,
      filename: finalFilename,
      size_kb: `${sizeKb} КБ`,
    });

    return NextResponse.json({
      status: "ok",
      time: timeShort,
      timestamp: dtStr,
      filename: finalFilename,
      student: studentRaw,
      task: `Практическая работа №${taskNum}`,
      size_kb: parseFloat(sizeKb),
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { status: "error", message: "Внутренняя ошибка сервера при сохранении файла" },
      { status: 500 }
    );
  }
}
