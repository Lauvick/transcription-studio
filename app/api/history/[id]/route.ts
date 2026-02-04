import { NextRequest, NextResponse } from "next/server";
import { deleteHistoryItem, readHistory } from "@/lib/history";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const deleted = await deleteHistoryItem(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Item introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Item supprimé" });
  } catch (error: any) {
    console.error("Delete history item error:", error);
    return NextResponse.json(
      { error: `Erreur serveur: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const history = await readHistory();
    const item = history.find((item) => item.id === id);

    if (!item) {
      return NextResponse.json(
        { error: "Item introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (error: any) {
    console.error("Get history item error:", error);
    return NextResponse.json(
      { error: `Erreur serveur: ${error.message}` },
      { status: 500 }
    );
  }
}

