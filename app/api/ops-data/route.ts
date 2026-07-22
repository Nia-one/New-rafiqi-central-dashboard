import { NextResponse } from "next/server";
import { buildOpsData } from "@/lib/opsDataMapper";

export async function GET() {
  try {
    const data = await buildOpsData();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Ops Data API Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}