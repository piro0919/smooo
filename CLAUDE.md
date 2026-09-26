@AGENTS.md

# Smooo

Looks like an ordinary chat app, except that people cannot post their own words. The spec was
settled in one long discussion on 2026-09-26 and built out the same day. Everything runs
locally; nothing is deployed yet.

## The core

**Cut down how often people have to read and think.** Take the friction and noise of working
with other people out of work chat.

Everyone has one AI. The AIs carry the conversation between themselves. A person types what
they want to say, however roughly, and what shows up in the channel is the message their AI
wrote. A person is only asked something when their AI cannot answer on its own.

The value is "you don't have to read or think", not "you don't have to write". Pitch it as "a
chat app where AI polishes your messages" and it loses to pasting ChatGPT output into Slack.

## API spend — read this before running anything that calls a model

**Every AI call is billed to a real person's key. Say how many calls and roughly how much
before running anything that makes them, and wait for a yes.** On 2026-09-26 about ¥1,800 went
on evals that were run again and again without asking. Local development borrows the
Anthropic key from Spatto, which belongs to someone else's work.

Rough cost, measured or estimated on 2026-09-26:

| What | Calls | Cost |
|---|---|---|
| One post in the app | 3–5 (rewrite, who answers, decide, draft) | ¥1–3 |
| `evals/format/run.py` on 30 cases, both models | 60 | about ¥10 |
| Same, `ONLY=sonnet` | 30 | about ¥7 |
| `evals/decide/run.mts 3` | 144, with thinking | ¥150–450 — the thinking tokens were never measured |

The dev server does not get the key by default: `.env.local` has no `ANTHROPIC_API_KEY`, and
without it posting shows "AI が文面を作成できませんでした" and no AI replies. Start the server with the
key only when asked to:

```sh
ANTHROPIC_API_KEY=$(grep '^ANTHROPIC_API_KEY=' ../spatto/.env.local | cut -d= -f2-) npm run dev
```

## Shape of the thing

| path | what it does |
|---|---|
| `src/proxy.ts` | Refreshes the Supabase session on every request and sends signed-out people to `/login` |
| `src/app/o/[orgId]/` | The Slack-shaped screen: organisation rail, channel list, channel |
| `src/app/o/[orgId]/c/[channelId]/actions.ts` | Posting: check membership, rewrite, then write with the secret key |
| `src/app/o/[orgId]/questions/` | "あなたへの質問": what the AI needs from you, answered with one tap |
| `src/app/join/[token]/` | Where an invite link lands. Signed-out people go through `/login` and come back |
| `src/app/welcome/` | The four onboarding questions |
| `src/app/api/cron/deadlines/` | Every 5 minutes: answer for people who let a question expire. Guarded by `CRON_SECRET` |
| `src/lib/messages.ts` | Loads a page of posts with reactions, the viewer's own drafts, and the viewer's open questions |
| `src/lib/ai/format.ts`, `format-system.md` | Rewrites what people type. The prompt file is shared with `evals/format/run.py` |
| `src/lib/ai/respond.ts` | Who has to answer a post, whether their AI answers or asks, drafts, memory sorting and revision |
| `src/lib/ai/pipeline.ts` | Runs the above after a post, an answer, a correction, or a deadline, and posts in the person's name |
| `supabase/migrations/` | Every table, policy, and function. The source of truth for the database |
| `supabase/tests/` | pgTAP tests for who can see and write what. `npm run test:db` |
| `src/lib/caps.ts` | Which organisation a post is billed to, and whether it is over its monthly cap |
| `scripts/dev-seed.mjs` | Fills a fresh local database with people, a company, channels, and posts |
| `evals/format/` | How the rewriting prompt and model were chosen |
| `evals/decide/` | Whether the AI answers or asks, per autonomy level, against expected actions |
| `scripts/dev-session.mjs`, `src/app/auth/dev/` | A local test user and a dev-only way in, to check screens without Google |

## Running it locally

- **Supabase runs locally.** The free plan allows two active projects and Spatto and Chappie
  hold both, so the cloud project gets created right before launch, on the paid plan that
  launch needs anyway. Migrations are the source of truth, so moving is just applying them.
- **Ports are 553xx, not 543xx,** so Spatto's local stack can run at the same time.
- **Open the app at `http://127.0.0.1:3000`, not `localhost`.** Supabase redirects back to
  127.0.0.1, and a session cookie set on one host is invisible on the other. `next.config.ts`
  allows 127.0.0.1 as a dev origin; without it Next blocks its own hot reload socket and the
  page never hydrates, so buttons silently do nothing.
- **Checking a screen without Google:** run `scripts/dev-session.mjs <email>` with
  `SUPABASE_SECRET_KEY` from `supabase status -o env` to create a test user, then open
  `http://127.0.0.1:3000/auth/dev?email=<email>`. The route is a 404 outside `next dev` and
  against anything but a local Supabase. The script also prints the session cookie, for
  headless browsers. Google sign-in itself has not been tried: it needs an OAuth client with
  `http://127.0.0.1:55321/auth/v1/callback`, and its ID and secret in `supabase/.env`.
- **Test data comes from `scripts/dev-seed.mjs`**, on a fresh database: 河村 (owner) and 佐藤
  at 株式会社サンプル, 鈴木 outside it, #general, #client-x, a DM, a few posts. No model calls.
- **Never edit a migration that has been applied, and don't run `supabase db reset` to pick up
  a change.** Add a new migration and run `supabase migration up`. A reset wipes everything
  someone was testing with; on 2026-09-26 it did, mid-session. If a reset happens anyway, run
  the seed again and say so.
- **Redirect to the host the request came in on, never `request.url`.** In dev, `request.url`
  says `localhost` even when the page was opened on 127.0.0.1, and the session cookie stays
  behind. `src/lib/origin.ts` builds it from the Host header.
- **Deadlines are handled by a cron route.** Locally, call `/api/cron/deadlines` with
  `Authorization: Bearer $CRON_SECRET` from `.env.local`. Every-5-minutes cron needs Vercel's
  paid plan, which launch assumes anyway.

## How it works

### Access

- **Who sees what is decided in Postgres, not in pages.** Membership checks live in
  `private.*` functions so policies do not recurse, and a trigger — not a policy — keeps
  outsiders out of internal channels, so an invite path added later cannot open a hole.
- **What people type and what gets posted live in separate tables.** `message_sources` holds the
  raw text and only its author can read it. Neither table accepts writes from a signed-in
  user; the server writes both with the secret key after the rewrite. Otherwise anyone could
  call the API and post their own words. Reactions, questions, and memory are server-written
  the same way.
- **Always name the foreign key when embedding the author of a message:**
  `profiles!messages_author_id_fkey(...)`. `reactions` links `messages` and `profiles` through
  its primary key, so PostgREST also sees a many-to-many path, and a bare `profiles(...)` fails
  as ambiguous. It failed silently: the pipeline read "no message" and returned, and the channel
  showed no posts. Query errors in the pipeline now throw.
- **Realtime needs the access token before subscribing.** Without `realtime.setAuth`, the
  socket joins as anonymous, the subscription reports success, and row level security
  silently drops every event.
- **A channel that does not exist or is not yours answers 200,** with the "見つかりません" page.
  `loading.tsx` makes the page stream, so the status is sent before the lookup. Nothing of the
  channel is sent either way; don't use the status code to test access.

### Organisations, channels, people

- **Everyone gets a personal organisation at sign-up.** A company organisation is created from
  the `+` on the rail, or joined through an invite link.
- **Two kinds of invite link, both valid for seven days.** One makes you a member of the
  organisation. The other, only for channels open to outsiders, puts you in that one channel.
  Accepting goes through `accept_invite`, a security definer function, because the person
  accepting cannot yet read the invite row.
- **An outsider sees a shared channel in their own sidebar,** under "社外とのチャンネル", with
  the inviting company's name — the way Slack Connect shows it, without guest types. They can
  read that company's name and nothing else: not its other channels, not its member list.
- **A DM is a channel with `kind = 'dm'`, between two people in the same organisation.** Nobody
  else in the organisation can see that it exists, let alone its posts. It is only created
  through `create_dm`, which returns the existing DM if there is one. DMs with outsiders are
  not built.
- **A channel's name opens its details:** who is in it, outsiders marked 社外, and leaving
  (not for DMs). The 社外 mark needs the owning company's member list, which guests cannot
  read, so a guest sees the list without marks.
- **Members are listed from "⋯" next to the organisation name, where you can also leave.**
  `leave_organization` also takes you out of that company's channels and DMs. Nobody can leave
  their personal organisation, and the last owner cannot leave a company.
- **Names and avatars change in 設定.** Avatars live in the public `avatars` bucket, under a
  folder named after the user id. Storage policies only let people write into their own folder,
  and `setAvatar` only accepts a URL inside it — otherwise someone could wear another person's
  face. Images use `unoptimized`, since Next will not optimise images from 127.0.0.1.

### Posting and the AI

- **A post is rewritten inline in the server action (about 2 seconds); everything else runs in
  `after()`,** so the poster is not kept waiting. There is no queue yet; one is needed before
  launch, because `after()` work is cut off at the function's time limit and lost if the
  instance crashes or a deploy replaces it — and a chain of AI replies can run long.
- **One call picks who has to answer and who reacts.** Reactions are one of 👍 🙏 🎉 👀 ✅ 😂, at
  most one per person, never from someone who is answering. People cannot react themselves.
  Jev was meant for this; Sonnet 5 stands in while sign-ups are closed.
- **A plain answer gets a reaction, not a thank-you.** If a post only answers someone's
  question and leaves them nothing to decide, the asker is not picked to reply. Before this,
  "同行可能です" drew an AI "ありがとうございます" — noise the product exists to remove. Six runs
  on three samples: five right, one needless reply.
- **The AI that picks respondents is told which post a reply points at.** Without that it
  picked whoever was named in the text, and 佐藤's AI answered a reply meant for 鈴木.
- **Per respondent, one call decides "answer" or "ask".** An answer is drafted as the person
  would type it and goes through `formatMessage`, so there is one rewriting prompt to evaluate.
  An ask creates a question and posts a fixed holding line — "確認して返信します。" inside,
  "確認のうえ、ご返信いたします。" with outsiders — without a model; rewriting it once came out as
  "確認して返送いたします".
- **The deciding prompt says whose voice to use.** The first chained reply had 河村's AI repeat
  佐藤's answer word for word. The prompt now says the post came from someone else and to move
  things forward from their answer, and a draft that only repeats the post is dropped.
- **AIs answer AI posts, up to a depth of 3.** `messages.depth` is 0 for a human post and one
  more than the post replied to for an AI post; nothing answers a post at depth 3, and a holding
  line sets nothing off. Checked on 2026-09-26: "月曜と金曜どっちがいい？" → 佐藤's AI "金曜の午後で"
  → 河村's AI "では金曜の午後でお願いします".
- **"佐藤さんの AI が返事を考えています…" shows while an AI prepares a reply,** from `ai_typing`
  rows that exist only for that span and are cleared even on failure; rows older than two
  minutes are ignored. It appears once the respondents are picked, about six seconds after
  sending. A follow-on AI reply starts only after the first indicator clears.
- **Questions from your AI show up under the post that caused them,** visible only to you, and
  in "あなたへの質問", with one-tap answers. Answering saves memory and posts the reply.
- **Past the deadline, `answerOverdueQuestions` flips `open` to `expired` and answers only the
  rows it flipped,** so overlapping cron runs cannot answer twice. The reply is yes-and, may
  commit, and is not saved to memory: nobody said it.
- **Nothing on screen says a post was written by an AI** — except to its author, where the
  "原文" toggle becomes "あなたの AI が書きました" and shows the draft.

### How far the AI may answer

Each person's setting, `profiles.autonomy`, chosen in 設定:

- **慎重** only repeats facts already stated and never makes a new commitment.
- **標準** answers what memory and the conversation make certain, and never takes on a request
  from a tendency like "基本的に引き受ける".
- **任せる** accepts everyday things — lunch, small tasks, a meeting in free time — and asks only
  about money, contracts, personnel, leave, big commitments, or when there is nothing to go on.

`evals/decide/` measures this: 16 cases × 3 levels × 3 runs. The first prompts committed when
they should have asked six times (慎重 turned "午後なら空いている" into "15時から大丈夫です"), and
任せる asked about lunch. After rewriting the levels (`results.md`): 慎重 48/48, 標準 45/48,
任せる 46/48, and every miss is on the safe side. Case 6 (19:00 against a 9–18 day) expects an
answer, but asking is arguably right; it was left as written rather than changed after the fact.

### Memory

- **Memory is saved with the scope of where it was learned.** Internal channels feed internal
  memory, used across the organisation's internal channels. A channel open to outsiders keeps
  its own memory, used only there. `general` memory is used everywhere: the onboarding answers,
  and answers given in internal channels that `classifyMemory` judges harmless for outsiders —
  the person's own availability, role, reachability. Company matters, clients, money, people
  decisions, and anything unclear stay internal. Three runs of seven samples never put anything
  sensitive in general; the one repeated miss, "議事録は自分がやる", was filed internal.
- **A correction rewrites memory.** `reviseMemories` drops what contradicts it and stores the
  corrected fact. After 佐藤 corrected "出席いたします" to "出られなくなった", the next "水曜来れる？"
  got "出席できません" without asking him.
- **Onboarding is four fixed multiple-choice questions** at `/welcome`, shown once before the
  first organisation screen: role, working hours, times bad for meetings, how they take
  requests. The answers are `general` memory, so the questions stay to things fine for
  outsiders to hear.

### Post caps

- **Each organisation has a monthly post cap,** 1000 for now (`private.default_post_cap()`,
  overridable per organisation in `post_cap`) until plans are priced. Human posts and posts an
  AI wrote in someone's name both count. The month starts at midnight Japan time.
- **Which organisation pays is fixed when the post is written,** in `messages.billed_org_id`:
  the channel's organisation if the author belongs to it, otherwise the author's own company
  (their first non-personal organisation, else their personal one). So an outsider's posts in
  a shared channel come out of their own company.
- **At the cap, posting stops before the model is called,** with "今月のメッセージ数が上限の1000件に達しました";
  the AI stops posting replies too. The sidebar shows "今月のメッセージ n / cap 件", in yellow from 90%.

### Screens

- **Slack is the reference for every screen, including its Japanese wording.** Rail, purple
  sidebar, square avatars, bold unread channels, hover actions on posts. On screen an
  organisation is ワークスペース, its owner オーナー, a post メッセージ; channels are 作成する,
  参加する, 退出する, and browsed in チャンネル一覧 — Slack's own Japanese terms, checked in its help
  centre on 2026-09-26. Code and tables keep `organization`, `messages`. The first pass had
  English (Organization, owner) and made-up verbs (抜ける, チャンネルを探す) on screen.
- **Posts are never edited.** A correction is a new post with `corrects` pointing at the
  original, shown with a 訂正 label and a quote. Only the person answerable for a post can
  correct it, including posts their AI wrote. Hover a post for 返信, and 訂正 on your own.
- **Unread channels are bold.** `channel_reads` keeps when each person last had a channel
  open; `unread_channel_ids()` runs with the caller's rights, so it only counts posts they can
  see, and never their own. The open channel is marked read whenever its newest post changes.
- **A channel opens on its latest 100 posts.** "これより前のメッセージを読み込む" adds 50 older ones at a
  time. The list is stacked from the bottom (`flex-col-reverse`), so adding above does not move
  what is on screen.
- **On phones the list and the channel are separate screens, as in Slack's app.** `OrgShell`
  shows only the sidebar at `/o/[orgId]` and only the content elsewhere; a back arrow returns
  to the list. The organisation home skips its jump to the first channel when the user agent
  says mobile. Posts show 返信 and 訂正 on tap.
- **It installs as a web app.** `manifest.ts` opens standalone. The icons (`icon.svg`,
  `apple-icon.tsx`, a white S on Slack purple) are placeholders; the real one goes through the
  usual ChatGPT icon workflow. iPhone needs the PNG `apple-icon`. Both are in the proxy's public
  paths, or they redirect to /login.

## Key decisions

### Positioning

- **Ends up B2B; starts out as something fun to play with.**
- **Public from day one** at `smooo.kkweb.io`. Move to its own domain when it turns B2B.
  `smooo.app` and `smooo.chat` were free on 2026-09-26.
- **A standalone app, not a Slack add-on.** On top of Slack, people could still post raw text,
  and the core would not hold.
- **Web plus PWA.** iPhone only delivers notifications to a PWA added to the home screen, so
  onboarding has to walk people through adding it.

### Conversation

- **Everyone is on Smooo, and every AI has a human who answers for what it says.** No bots.
- **The input box is an ordinary chat input.** What you type and what gets shown differ.
- **Only the author can see what they originally typed.** Whether admins can too is decided
  when it turns B2B, and if they can, users are told.
- **Messages are polite Japanese (丁寧語) throughout.**
- **Channels and DMs, like Slack.** The AI keeps track of which topic each post belongs to;
  the screen only shows a quote of the post being replied to. This is provisional.

### Asking the human

- **The AI asks only when it cannot answer**, and posts once it has what it needs.
- **Answers are mostly buttons.** A text box opens only behind the last option, "その他".
- **An open question does not stop other topics.**
- **Deadlines come from the message if it names one**; otherwise the AI picks one from how
  urgent it looks.
- **Past the deadline, the AI answers in the person's place, in a yes-and way.** It may make
  commitments, and nothing marks the reply as a guess. The person who did not answer owns the
  result. Having things move forward in your name is the reason to answer.
- **The line between answering and asking is each person's setting.** The plan was TypeSafe's
  Jev for this call; sign-ups were closed on 2026-09-26, so Sonnet 5 stands in.

### Memory

- **What a person answers, the AI remembers and reuses. Memory is never shown;** it changes
  when someone posts a correction.
- **Three kinds of memory:** internal, general (fine to share with anyone), and per-counterpart
  (learned in a channel shared with outsiders, used only there).

### Organisations and outsiders

- **Everyone belongs to an organisation.** A sole trader gets a one-person organisation.
- **Channels are either internal or open to outsiders.** Outsiders cannot be invited to an
  internal channel.
- **No guest types.** Slack Connect's external and single-channel guests were exactly what
  made it unpleasant.

### Cost

- **Smooo pays for the AI. No bring-your-own-key.** ChatGPT and Claude subscriptions do not
  include an API key, so BYOK would not spare anyone a second bill anyway.
- **Free plan: a monthly cap on posts. Paid plan: a monthly fee that includes a cap, then
  pay for what goes over.** The cap is built; plans and billing are not.
- **Caps are counted per organisation.** Usage per person varies by orders of magnitude —
  about one post a day to a thousand — and pooling absorbs that.
- **Most of the cost is input.** Keep what the model reads down to posts in the same topic.

## Model for rewriting messages

**Sonnet 5 (`claude-sonnet-5`, effort low).** Compared with Haiku 4.5 in `evals/format/`.

| | Haiku 4.5 | Sonnet 5 |
|---|---|---|
| Clear failures on 30 unseen inputs, first run | 3 | 0 |
| Cost per message | $0.00076 | $0.00153 |

Haiku kept failing even after the prompt forbade it: it answered "？" with a note about having
nothing to rewrite, swapped a manager and their report, and greeted a client with
「お疲れ様です」. The note would have been posted as the person's own message.

**One run per case measures luck, not the prompt.** The exact prompt that scored 0 clear
failures on `cases2.json` scored 2–3 on a rerun, including the note-to-self kind
(「上司(社内)への文面です。」 posted as the message).

**The rewrite comes back as JSON, `{ "message": ... }`.** Three runs of `cases2.json` in this
mode (`results_v5_unseen_json_run*.md`, 90 outputs): no notes-to-self, one clear failure
(「？」 answered with a made-up request to confirm something).

**Who is inside and who is outside goes in the recipient line, not the system prompt.** In a
channel with outsiders, the line lists colleagues and outsiders and says: address colleagues
as colleagues, never add a name the input did not use (`mixedAudience` in `format.ts`, same
text in `cases_mixed.json`). Putting that rule in the system prompt made the model deliberate
about addressees on every internal message too, and write the deliberation into the post. In
DMs the line names the other person and says 1対1, 社内.

After changing the prompt, run `cases2.json` too — `cases.json` was in view while the prompt was
written, so scores on it read high. Say the cost first; see "API spend".

## Open questions

- Whether "don't state a fact you cannot point to a source for; ask instead" becomes a fixed
  rule, separate from the threshold.
- Who uses it first.
- When to send notifications.
- The screen structure. The reply quote is a placeholder.
- Whether an in-app calendar ships at launch. If it does, Google Calendar is read-only and
  Smooo's events reach Google Calendar through an iCal feed it subscribes to.

## Not built yet

- A queue for AI work, instead of `after()`.
- Plans and billing on top of the post cap.
- Notifications.
- Google sign-in, tried for real.
- The real icon.
- A cloud Supabase project and a Vercel deploy.

## Dropped

### Integrations at launch

The plan was MCP connections to Gmail, Google Calendar, and Drive. Reading Gmail is a
restricted Google scope: a public app needs verification plus a third-party security
assessment every year. Reading all of Drive is the same tier. An unverified app is capped at
100 users and shows a warning screen. MCP does not change this — as long as Smooo is the one
receiving the user's grant, Smooo gets reviewed. Calendar only needs verification, but it went
too. Integrations come later, as a way to cut down questions. Google sign-in stays; name and
email need no review to speak of.

### Slack integration

Since May 2025, apps not on the Slack Marketplace get one request a minute and 15 messages per
call from the channel history API. Slack's official MCP server is limited to Marketplace and
internal apps. Not worth the review.

### Rewriting only the posts someone reads

The idea: AIs exchange terse notes and only get rewritten when a person opens the channel. About
80% of the cost is input and only 20% is the rewritten output, so it barely saves anything, and
a post that does get read costs an extra call.

### Marking late answers, or keeping commitments out of them

Both weaken "it's on whoever didn't answer" and make the chat less smooth. Every post is written
by an AI, so marking only the late ones is inconsistent.
