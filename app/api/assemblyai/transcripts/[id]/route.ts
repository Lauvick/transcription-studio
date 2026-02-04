import { NextRequest, NextResponse } from "next/server";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2/transcript";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!ASSEMBLYAI_API_KEY) {
    return NextResponse.json(
      { error: "ASSEMBLYAI_API_KEY non configurée" },
      { status: 500 }
    );
  }

  try {
    const { id } = params;
    const url = `${ASSEMBLYAI_BASE_URL}/${id}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AssemblyAI get transcript error:", errorText);

      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "Clé API AssemblyAI invalide ou expirée" },
          { status: response.status }
        );
      }

      if (response.status === 404) {
        return NextResponse.json(
          { error: "Transcription introuvable" },
          { status: 404 }
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
    console.error("Get transcript error:", error);
    return NextResponse.json(
      { error: `Erreur serveur: ${error.message}` },
      { status: 500 }
    );
  }
}

