
import { NextRequest, NextResponse } from "next/server";
import { importHistory } from "@/lib/history";
import { z } from "zod";

// This schema validates the structure of each item in the imported JSON file.
const historyItemSchema = z.object({
  id: z.string(),
  status: z.string(),
  url: z.string().url(),
  transcript: z.string(),
  created_at: z.string().datetime(), // Ensures created_at is a valid ISO 8601 date string
});

// The body of the POST request should be an array of history items.
const importSchema = z.array(historyItemSchema);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedItems = importSchema.parse(body);

    await importHistory(validatedItems);
    return NextResponse.json({ message: "History imported successfully" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid JSON format", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Import history error:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}
