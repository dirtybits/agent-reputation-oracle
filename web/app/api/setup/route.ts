import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";

export async function POST() {
  try {
    await initializeDatabase();
    return NextResponse.json({
      success: true,
      message: "Database tables created",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
