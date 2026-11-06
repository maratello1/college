import { NextResponse } from "next/server";
import { readSubmissionsFromCsv } from "../../../lib/csv";
import { STUDENTS_1RUP8 } from "../../../lib/constants";

export async function GET() {
  try {
    const submissions = await readSubmissionsFromCsv();

    const uniqueStudents = new Set<string>();
    const breakdown: Record<string, number> = {};

    for (const sub of submissions) {
      uniqueStudents.add(sub.student.trim());
      breakdown[sub.task] = (breakdown[sub.task] || 0) + 1;
    }

    const groupSize = STUDENTS_1RUP8.length;
    const uniqueCount = uniqueStudents.size;
    const percent = groupSize > 0 ? Math.round((uniqueCount / groupSize) * 100) : 0;

    return NextResponse.json({
      status: "ok",
      total_submissions: submissions.length,
      unique_students: uniqueCount,
      group_size: groupSize,
      percent,
      group_name: "1РУП8",
      breakdown,
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { status: "error", message: "Не удалось получить статистику группы" },
      { status: 500 }
    );
  }
}
