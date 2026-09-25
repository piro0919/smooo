import { safeNext } from "@/lib/next-path";
import { OnboardingForm } from "./OnboardingForm";

// 最初にログインしたときに1度だけ出す。答えは AI が最初に覚えることになり、
// そのぶん最初の数日の質問が減る
export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto grid w-full max-w-xl gap-8 px-6 py-12">
      <div className="grid gap-2">
        <h1 className="text-2xl font-bold">はじめに</h1>
        <p className="text-muted-foreground">
          あなたの AI が最初に覚えることです。ここで答えておくと、あとで AI からの質問が減ります。
          答えは、社外の人とのやり取りでも使われます。
        </p>
      </div>
      <OnboardingForm next={safeNext(typeof next === "string" ? next : undefined)} />
    </main>
  );
}
