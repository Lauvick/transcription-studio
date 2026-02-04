import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Fonctionnalité de traduction non configurée",
      message: "Cette fonctionnalité nécessite une configuration supplémentaire.",
    },
    { status: 501 }
  );
}

