import { NextResponse } from "next/server";
import fs from "fs";
import { CSV_PATH } from "../../../lib/csv";

export async function GET() {
  try {
    if (!fs.existsSync(CSV_PATH)) {
      return new NextResponse("Журнал пуст", { status: 404 });
    }

    const fileBuffer = await fs.promises.readFile(CSV_PATH);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="submissions_log.csv"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Download log error:", error);
    return new NextResponse("Ошибка при скачивании файла", { status: 500 });
  }
}
