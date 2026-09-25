import { NextResponse, type NextRequest } from "next/server";
import { answerOverdueQuestions } from "@/lib/ai/pipeline";

// Vercel Cron から5分おきに呼ばれる。CRON_SECRET を知っている呼び出しだけ受ける
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }
  return NextResponse.json(await answerOverdueQuestions());
}

// AI の返事を待つので長めに取る
export const maxDuration = 300;
