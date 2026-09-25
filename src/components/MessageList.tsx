import type { MessageItem as Item } from "@/lib/messages";
import { MessageItem } from "./MessageItem";
import { OlderMessages } from "./OlderMessages";

export function MessageList({
  channelId,
  messages,
  hasOlder,
  userId,
}: {
  channelId: string;
  messages: Item[];
  hasOlder: boolean;
  userId: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
        まだ投稿はありません。
      </div>
    );
  }

  return (
    // 下から積む。新しい投稿が来ても、いちばん下が見えたままになる
    <div className="flex flex-1 flex-col-reverse overflow-y-auto py-4">
      <ol>
        {hasOlder && <OlderMessages channelId={channelId} oldest={messages[0].created_at} userId={userId} />}
        {messages.map((m) => (
          <MessageItem key={m.id} m={m} userId={userId} />
        ))}
      </ol>
    </div>
  );
}
