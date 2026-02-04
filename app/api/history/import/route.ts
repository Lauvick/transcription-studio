import { NextRequest, NextResponse } from "next/server";
import { importHistory } from "@/lib/history";
import { z } from "zod";

const historyItemSchema = z.object({
  id: z.string(),
  type: z.enum(["transcription", "text"]),
  text: z.string(),
  language: z.string().optional(),
  languageCodes: z.array(z.string()).optional(),
  createdAt: z.string(),
  metadata: z.any().optional(),
});

const importSchema = z.array(historyItemSchema);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = importSchema.parse(body);

    await importHistory(validated);
    return NextResponse.json({ message: "Historique importé avec succès" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Format JSON invalide", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Import history error:", error);
    return NextResponse.json(
      { error: `Erreur serveur: ${error.message}` },
      { status: 500 }
    );
  }
}

