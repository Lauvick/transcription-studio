
import { NextRequest, NextResponse } from "next/server";
import { readHistory, addHistoryItem, clearHistory } from "@/lib/history";
import { z } from "zod";

// This schema validates the body of the POST request according to the new DB structure
const addHistorySchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  url: z.string().url(),
  transcript: z.string(),
});

// GET /api/history - Fetches the entire history
export async function GET() {
  try {
    const history = await readHistory();
    return NextResponse.json(history);
  } catch (error: any) {
    console.error("Read history error:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}

// POST /api/history - Adds a new item to the history
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = addHistorySchema.parse(body);

    // The created_at field will be set by the database default
    await addHistoryItem(validatedData);
    
    // Return the added item along with a 201 status code
    return NextResponse.json(validatedData, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Add history error:", error);
    // Handle potential database errors, e.g., unique constraint violation
    if ((error as any).code === '23505') { // PostgreSQL unique violation
        return NextResponse.json(
            { error: "An item with this ID already exists." },
            { status: 409 } // 409 Conflict
        );
    }
    
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}

// DELETE /api/history - Clears the entire history
export async function DELETE() {
  try {
    await clearHistory();
    return NextResponse.json({ message: "History cleared" });
  } catch (error: any) {
    console.error("Clear history error:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}
