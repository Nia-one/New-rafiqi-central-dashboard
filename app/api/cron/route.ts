import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function GET() {
  try {
    await execAsync("node scripts/sync-dashboard-history.js");

    return NextResponse.json({
      success: true,
      message: "Dashboard sync completed",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}