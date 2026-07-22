import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboardService";

export async function GET() {
  try {
    const data = await getDashboardData();

    return NextResponse.json({
      success: true,
      data,
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