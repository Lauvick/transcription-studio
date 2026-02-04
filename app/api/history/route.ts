import { NextRequest, NextResponse } from "next/server";
import { readHistory, addHistoryItem, clearHistory } from "@/lib/history";
import { z } from "zod";

const addHistorySchema = z.object({
  type: z.enum(["transcription", "text"]),
  text: z.string().min(1),
  language: z.string().optional(),
  languageCodes: z.array(z.string()).optional(),
  metadata: z.object({
    filename: z.string().optional(),
    speakerLabels: z.boolean().optional(),
    punctuate: z.boolean().optional(),
  }).optional(),
});

export async function GET() {
  try {
    const history = await readHistory();
    return NextResponse.json(history);
  } catch (error: any) {
    console.error("Read history error:", error);
    return NextResponse.json(
      { error: `Erreur serveur: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = addHistorySchema.parse(body);

    const item = {
      id: crypto.randomUUID(),
      ...validated,
      createdAt: new Date().toISOString(),
    };

    await addHistoryItem(item);
    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Add history error:", error);
    return NextResponse.json(
      { error: `Erreur serveur: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearHistory();
    return NextResponse.json({ message: "Historique effacé" });
  } catch (error: any) {
    console.error("Clear history error:", error);
    return NextResponse.json(
      { error: `Erreur serveur: ${error.message}` },
      { status: 500 }
    );
  }
}

