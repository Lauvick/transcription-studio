
import { NextRequest, NextResponse } from "next/server";
import { deleteHistoryItem, getHistoryItem } from "@/lib/history";

// DELETE /api/history/[id] - Deletes a specific history item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const deleted = await deleteHistoryItem(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Item deleted" });
  } catch (error: any) {
    console.error("Delete history item error:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}

// GET /api/history/[id] - Fetches a specific history item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const item = await getHistoryItem(id);

    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (error: any) {
    console.error("Get history item error:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}
