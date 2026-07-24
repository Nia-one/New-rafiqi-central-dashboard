import { NextResponse } from "next/server";
import { getSheet } from "@/lib/googleSheets";

export async function GET() {
  try {
    const action = await getSheet("Action_Log!A:AZ");
    const evidence = await getSheet("Evidence_Log!A:AZ");
    const approval = await getSheet("Approval_Log!A:AZ");

    return NextResponse.json({
      success: true,
      action: {
        rows: action.length,
        data: action.slice(0, 3),
      },
      evidence: {
        rows: evidence.length,
        data: evidence.slice(0, 3),
      },
      approval: {
        rows: approval.length,
        data: approval.slice(0, 3),
      },
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