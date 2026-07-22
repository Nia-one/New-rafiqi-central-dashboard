import { NextResponse } from "next/server";
import { buildOpsData } from "@/lib/opsDataMapper";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await buildOpsData();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
      }
    );
  }
}