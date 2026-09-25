"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// 返信や訂正の対象。投稿の横のボタンで選び、入力欄が読む
export type Target = { id: string; kind: "reply" | "correct"; author: string; body: string };

const Context = createContext<{ target: Target | null; setTarget: (t: Target | null) => void }>({
  target: null,
  setTarget: () => {},
});

export function ComposerTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  return <Context value={{ target, setTarget }}>{children}</Context>;
}

export function useComposerTarget() {
  return useContext(Context);
}
