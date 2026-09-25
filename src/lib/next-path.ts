// ログイン後の戻り先。自分のサイトの中のパスだけ受け付ける。//evil.example のような外への飛び先を弾く
export function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
