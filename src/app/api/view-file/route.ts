import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ALLOWED_VIEW_EXTENSIONS = new Set([
  ".py",
  ".txt",
  ".csv",
  ".json",
  ".md",
  ".sql",
  ".html",
  ".css",
  ".js",
  ".ts",
]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json(
        { status: "error", message: "Не указано имя файла" },
        { status: 400 }
      );
    }

    // Защита от Path Traversal
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.includes("%2e%2e") ||
      filename.includes("\0")
    ) {
      return NextResponse.json(
        { status: "error", message: "Недопустимое имя файла" },
        { status: 400 }
      );
    }

    const safeBase = path.basename(filename);
    const ext = path.extname(safeBase).toLowerCase();

    // Проверяем папку uploads, а затем tasks
    let targetPath = path.join(process.cwd(), "uploads", safeBase);
    if (!fs.existsSync(targetPath)) {
      targetPath = path.join(process.cwd(), "tasks", safeBase);
    }

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json(
        { status: "error", message: "Файл не найден" },
        { status: 404 }
      );
    }

    if (!ALLOWED_VIEW_EXTENSIONS.has(ext)) {
      return NextResponse.json({
        status: "binary",
        filename: safeBase,
        message: "Предпросмотр доступен для текстовых файлов и кода (.py, .txt, .csv)",
      });
    }

    // Читаем безопасно с лимитом 1МБ
    const stat = fs.statSync(targetPath);
    if (stat.size > 1024 * 1024) {
      return NextResponse.json(
        { status: "error", message: "Файл слишком велик для быстрого предпросмотра" },
        { status: 400 }
      );
    }

    const content = fs.readFileSync(targetPath, "utf-8");

    return NextResponse.json({
      status: "ok",
      filename: safeBase,
      ext,
      size_bytes: stat.size,
      lines_count: content.split("\n").length,
      content,
    });
  } catch (error) {
    console.error("GET /api/view-file error:", error);
    return NextResponse.json(
      { status: "error", message: "Ошибка при чтении файла" },
      { status: 500 }
    );
  }
}
