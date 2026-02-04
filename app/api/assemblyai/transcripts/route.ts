import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_TRANSCRIPTS_URL = "https://api.assemblyai.com/v2/transcript";

const transcriptSchema = z.object({
  audio_url: z.string().url(),
  language_code: z.string().optional(),
  language_codes: z.array(z.string()).optional(),
  speaker_labels: z.boolean().optional(),
  punctuate: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  if (!ASSEMBLYAI_API_KEY) {
    return NextResponse.json(
      { error: "ASSEMBLYAI_API_KEY non configurée" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const validated = transcriptSchema.parse(body);

    const payload: any = {
      audio_url: validated.audio_url,
    };

    if (validated.language_codes && validated.language_codes.length > 0) {
      payload.language_codes = validated.language_codes;
    } else if (validated.language_code) {
      payload.language_code = validated.language_code;
    }

    if (validated.speaker_labels !== undefined) {
      payload.speaker_labels = validated.speaker_labels;
    }

    if (validated.punctuate !== undefined) {
      payload.punctuate = validated.punctuate;
    }

    const response = await fetch(ASSEMBLYAI_TRANSCRIPTS_URL, {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AssemblyAI transcript error:", errorText);

      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "Clé API AssemblyAI invalide ou expirée" },
          { status: response.status }
        );
      }

      return NextResponse.json(
        { error: `Erreur AssemblyAI: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Transcript creation error:", error);
    return NextResponse.json(
      { error: `Erreur serveur: ${error.message}` },
      { status: 500 }
    );
  }
}

