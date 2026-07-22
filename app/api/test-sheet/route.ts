import { NextResponse } from "next/server";
import { getSheet } from "@/lib/googleSheets";

export async function GET() {
  try {
    // Change "Reference_Master" if your first sheet has a different name
   const data = await getSheet("Source_Registry!A:Z");

    return NextResponse.json({
      success: true,
      rows: data.length,
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