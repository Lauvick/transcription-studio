
import { NextResponse } from "next/server";
import { readHistory } from "@/lib/history";

export async function GET() {
  try {
    const history = await readHistory();
    const json = JSON.stringify(history, null, 2);
    
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="transcriptions-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error: any) {
    console.error("Export history error:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}
