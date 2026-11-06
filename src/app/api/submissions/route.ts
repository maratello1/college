import { NextResponse } from "next/server";
import { readSubmissionsFromCsv } from "../../../lib/csv";

export async function GET() {
  try {
    const submissions = await readSubmissionsFromCsv();
    return NextResponse.json({
      status: "ok",
      submissions: submissions.slice(0, 50),
    });
  } catch (error) {
    console.error("Submissions API error:", error);
    return NextResponse.json(
      { status: "error", message: "Не удалось прочитать журнал сдачи" },
      { status: 500 }
    );
  }
}
