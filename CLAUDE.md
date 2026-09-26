@AGENTS.md

# Smooo

Looks like an ordinary chat app, except that people cannot post their own words. The spec was
settled in one long discussion on 2026-09-26. So far there is sign-in, organisations, channels, and
posting — what someone types is rewritten by Sonnet 5 and only the rewrite reaches the
channel — invite links, and the AI answering for people: when someone is asked something, their
AI answers from memory or asks them first, and answers for them once the deadline passes.

## The core

**Cut down how often people have to read and think.** Take the friction and noise of working
with other people out of work chat.

Everyone has one AI. The AIs carry the conversation between themselves. A person types what
they want to say, however roughly, and what shows up in the channel is the message their AI
wrote. A person is only asked something when their AI cannot answer on its own.

The value is "you don't have to read or think", not "you don't have to write". Pitch it as "a
chat app where AI polishes your messages" and it loses to pasting ChatGPT output into Slack.

## Shape of the thing

| path | what it does |
|---|---|
| `supabase/migrations/` | Organisations, profiles, memberships, channels, channel members, and who can see what |
| `supabase/tests/rls_test.sql` | pgTAP tests for the above. Outsiders must never reach an internal channel |
| `src/proxy.ts` | Refreshes the Supabase session on every request and sends signed-out people to `/login` |
| `supabase/tests/avatars_test.sql` | Nobody can put an image in someone else's avatar folder |
| `supabase/tests/reads_test.sql` | Unread counts only other people's posts and clears on opening |
| `supabase/tests/dms_test.sql` | A DM is invisible to everyone but its two people; one DM per pair |
| `supabase/tests/invites_test.sql` | Invites: none for internal channels, expired links refused, outsiders land in one channel only |
| `src/app/join/[token]/` | Where an invite link lands. Signed-out people go through `/login` and come back |
| `supabase/tests/messages_test.sql` | Nobody can write a post directly, and only the author reads what they typed |
| `src/app/o/[orgId]/` | The Slack-shaped screen: organisation rail, channel list, channel |
| `src/app/o/[orgId]/c/[channelId]/actions.ts` | Posting: check membership, rewrite, then write with the secret key |
| `src/lib/messages.ts` | Loads a page of posts with their reactions and the viewer's own drafts |
| `src/lib/ai/respond.ts` | Who has to answer a post, whether their AI can answer or must ask, and drafting from an answer |
| `src/lib/ai/pipeline.ts` | Runs the above after a post or an answer, and posts in the person's name |
| `src/app/api/cron/deadlines/` | Every 5 minutes: answer for people who let a question expire. Guarded by `CRON_SECRET` |
| `src/app/o/[orgId]/questions/` | "あなたへの質問": what the AI needs from you, answered with one tap |
| `supabase/tests/questions_test.sql` | Questions are readable only by the person asked; memory by nobody |
| `src/lib/ai/format-system.md` | The rewriting prompt. `evals/format/run.py` reads the same file |
| `evals/format/` | The prompt that rewrites what people type, and how it was chosen |
| `scripts/dev-session.mjs`, `src/app/auth/dev/` | A local test user and a dev-only way in, to check screens without Google |

## Local development

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
  headless browsers.
- **Redirect to the host the request came in on, never `request.url`.** In dev, `request.url`
  says `localhost` even when the page was opened on 127.0.0.1, and the session cookie stays
  behind. `src/lib/origin.ts` builds it from the Host header.
- **Who sees what is decided in Postgres, not in pages.** Membership checks live in
  `private.*` functions so policies do not recurse, and a trigger — not a policy — keeps
  outsiders out of internal channels, so an invite path added later cannot open a hole.
- **What people type and what gets posted live in separate tables.** `message_sources` holds the
  raw text and only its author can read it. Neither table accepts writes from a signed-in
  user; the server writes both with the secret key after the rewrite. Otherwise anyone could
  call the API and post their own words.
- **Posts are rewritten inline, inside the server action,** for now. It takes about two
  seconds. When AIs start talking to each other this moves to a queue.
- **Reactions are chosen by the AI, in the same call that picks who has to answer.** One of
  👍 🙏 🎉 👀 ✅ 😂, at most one per person, never from someone who is answering. People cannot
  react themselves. Jev was meant for this; Sonnet 5 stands in while sign-ups are closed.
- **Always name the foreign key when embedding the author of a message:**
  `profiles!messages_author_id_fkey(...)`. `reactions` links `messages` and `profiles` through
  its primary key, so PostgREST also sees a many-to-many path, and a bare `profiles(...)` fails
  as ambiguous. It failed silently: the pipeline read "no message" and returned, and the channel
  showed no posts. Query errors in the pipeline now throw.
- **A channel shows a skeleton while it loads.** Because of that `loading.tsx`, the page streams,
  and a channel that does not exist or is not yours answers 200 with the "見つかりません" page,
  not 404. Nothing of the channel is sent either way; don't use the status code to test access.
- **A channel opens on its latest 100 posts.** "これより前の投稿を読み込む" at the top adds 50
  older ones at a time. The list is stacked from the bottom (`flex-col-reverse`), so adding
  above does not move what is on screen.
- **Unread channels are bold in the sidebar, as in Slack.** `channel_reads` keeps when each
  person last had a channel open; `unread_channel_ids()` runs with the caller's rights, so it
  only counts posts they can see, and never their own — including posts their AI wrote. The
  open channel is marked read whenever its newest post changes. The sidebar refreshes on any
  visible new post.
- **Realtime needs the access token before subscribing.** Without `realtime.setAuth`, the
  socket joins as anonymous, the subscription reports success, and row level security
  silently drops every event.
- **After a human post, the AI works in `after()`,** so the poster is not kept waiting. One call
  picks who has to answer; then, per person, one call decides "answer from memory" or "ask".
  Either way something is posted in their name: the answer, or a fixed holding line —
  "確認して返信します。" inside, "確認のうえ、ご返信いたします。" with outsiders. The holding line
  skips the model; rewriting it once came out as "確認して返送いたします". Answering a
  question saves it to memory and posts the reply. Roughly 5 seconds end to end.
- **How far the AI may answer is each person's setting,** `profiles.autonomy`: 慎重 answers only
  when memory holds this exact answer, 標準 only what memory and the conversation make certain,
  任せる whatever follows reasonably, asking only about money, contracts, people decisions, big
  commitments, or when there is nothing to go on. Checked on 2026-09-26: the same light request
  ("議事録お願いできる？") was accepted under 任せる and turned into a question under 標準.
- **Past the deadline, `answerOverdueQuestions` flips `open` to `expired` and answers only the
  rows it flipped,** so overlapping cron runs cannot answer twice. The reply is yes-and, may
  commit, and is not saved to memory: nobody said it. Every-5-minutes cron needs Vercel's paid
  plan, which launch assumes anyway. Locally, call the route with the secret from `.env.local`.
- **AI drafts go through the same rewriting prompt as typed text.** The deciding model writes
  what the person would have typed, and `formatMessage` polishes it. One prompt to evaluate.
- **AIs answer AI posts, up to a depth of 3.** `messages.depth` is 0 for a human post and one
  more than the post replied to for an AI post; nothing answers a post at depth 3. A holding
  line like "確認して返します" never sets anything off. Without a limit two AIs keep thanking
  each other.
- **A plain answer gets a reaction, not a thank-you.** If a post only answers someone's
  question and leaves them nothing to decide, the asker is not picked to reply; the reaction
  covers it. Before this, "同行可能です" drew an AI "ありがとうございます" — noise the product
  exists to remove. Six runs on three samples: five right, one needless reply.
- **Questions from your AI show up under the post that caused them,** visible only to you, with
  the same one-tap answers as "あなたへの質問".
- **The deciding prompt says whose voice to use.** The first chained reply had 河村's AI repeat
  佐藤's answer word for word — it wrote as the sender, not the receiver. The prompt now says
  the post came from someone else and to move things forward from their answer, and a draft
  that only repeats the post is dropped. Checked on 2026-09-26: "月曜と金曜どっちがいい？" →
  佐藤's AI "金曜の午後で" → 河村's AI "では金曜の午後でお願いします".
- **Nothing on screen says a post was written by an AI** — except to its author, where the
  "原文" toggle becomes "あなたの AI が書きました" and shows the draft.
- **Memory is saved with the scope of where it was learned.** Internal channels feed internal
  memory, used across the organisation's internal channels. A channel open to outsiders keeps
  its own memory, used only there. `general` memory is used everywhere: the onboarding answers,
  and answers given in internal channels that `classifyMemory` judges harmless for outsiders —
  the person's own availability, role, reachability. Company matters, clients, money, people
  decisions, and anything unclear stay internal. On 2026-09-26, over three runs of seven
  samples, it never put anything sensitive in general; the only miss each time was "議事録は
  自分がやる" filed as internal, which errs the safe way.
- **Onboarding is four fixed multiple-choice questions** at `/welcome`, shown once before the
  first organisation screen: role, working hours, times bad for meetings, how they take
  requests. Nothing to personalise them with since Google data is out. The answers are
  `general` memory, so the questions stay to things fine for outsiders to hear. Checked on
  2026-09-26: in a channel with outsiders, "何時まで仕事してる？" was answered from the
  working-hours answer without asking.
- **Everyone gets a personal organisation at sign-up.** A company organisation is created from
  the `+` on the rail, or joined through an invite link.
- **Members are listed from "⋯" next to the organisation name, where you can also leave.**
  `leave_organization` also takes you out of that company's channels and DMs. Nobody can leave
  their personal organisation, and the last owner cannot leave a company — nobody would be
  left to run it. Names and avatars change in 設定.
- **Avatars live in the public `avatars` bucket, under a folder named after the user id.**
  Storage policies only let people write into their own folder, and `setAvatar` only accepts a
  URL inside it — otherwise someone could wear another person's face. Images are shown with
  `unoptimized`, since Next will not optimise images from 127.0.0.1.
- **Two kinds of invite link, both valid for seven days.** One makes you a member of the
  organisation. The other, only for channels open to outsiders, puts you in that one channel.
  Accepting goes through `accept_invite`, a security definer function, because the person
  accepting cannot yet read the invite row.
- **An outsider sees a shared channel in their own sidebar,** under "社外とのチャンネル", with
  the inviting company's name — the way Slack Connect shows it, without guest types. They can
  read that company's name and nothing else: not its other channels, not its member list.

## Key decisions

### Positioning

- **Ends up B2B; starts out as something fun to play with.**
- **Public from day one** at `smooo.kkweb.io`. Move to its own domain when it turns B2B.
  `smooo.app` and `smooo.chat` were free on 2026-09-26.
- **A standalone app, not a Slack add-on.** On top of Slack, people could still post raw text,
  and the core would not hold.
- **Web plus PWA.** iPhone only delivers notifications to a PWA added to the home screen, so
  onboarding has to walk people through adding it. The manifest and icons are not made yet.
- **On phones the list and the channel are separate screens, as in Slack's app.** `OrgShell`
  shows only the sidebar at `/o/[orgId]` and only the content elsewhere; a back arrow returns
  to the list. The organisation home skips its jump to the first channel when the user agent
  says mobile, since on a phone that page is the list. Posts show 返信 and 訂正 on tap.

### Conversation

- **Everyone is on Smooo, and every AI has a human who answers for what it says.** No bots.
- **The input box is an ordinary chat input.** What you type and what gets shown differ.
- **Only the author can see what they originally typed.** Whether admins can too is decided
  when it turns B2B, and if they can, users are told.
- **Messages are polite Japanese (丁寧語) throughout.**
- **Posts are never edited.** A correction is a new post with `corrects` pointing at the
  original, shown with a 訂正 label and a quote. Only the person answerable for a post can
  correct it, including posts their AI wrote. A correction rewrites that person's memory:
  `reviseMemories` drops what contradicts it and stores the corrected fact. Checked on
  2026-09-26: after 佐藤 corrected "出席いたします" to "出られなくなった", the old memory was
  gone and the next "水曜来れる？" got "出席できません" without asking him.
- **People can reply to a specific post.** Hover a post for 返信 (and 訂正 on your own). The AI
  that picks who has to answer is told which post a reply points at; without that it picked
  whoever was named in the text, and 佐藤's AI answered a reply meant for 鈴木.
- **Reactions are the AI's job too.**
- **Channels and DMs, like Slack.** The AI keeps track of which topic each post belongs to;
  the screen only shows a quote of the post being replied to. This is provisional.
- **A DM is a channel with `kind = 'dm'`, between two people in the same organisation.** Nobody
  else in the organisation can see that it exists, let alone its posts. It is only created
  through `create_dm`, which returns the existing DM if there is one. DMs with outsiders are
  not built. The formatter is told "1対1, 社内" and the name of the other person.

### Asking the human

- **The AI asks only when it cannot answer**, and posts once it has what it needs.
- **Answers are mostly buttons.** A text box opens only behind the last option, "Other".
- **An open question does not stop other topics.**
- **Deadlines come from the message if it names one**; otherwise the AI picks one from how
  urgent it looks.
- **Past the deadline, the AI answers in the person's place, in a yes-and way.** It may make
  commitments, and nothing marks the reply as a guess. The person who did not answer owns the
  result. Having things move forward in your name is the reason to answer.

### Deciding when to ask

- **A classifier decides whether the AI may answer without asking.** Each person sets the
  threshold, shown as steps such as careful / normal / let it go.
- **The plan was TypeSafe's Jev.** Sign-ups were closed on 2026-09-26, so a language model
  stands in for now.

### Memory

- **What a person answers, the AI remembers and reuses.**
- **Memory is never shown.** It is rewritten when someone posts a correction in the chat.
- **Three kinds of memory.** Internal: learned inside the organisation, used only there.
  External: general facts that are fine to share with anyone. Per-counterpart: learned in a
  channel shared with one organisation, used only with that organisation.
- **Onboarding is a few multiple-choice questions**; the rest is learned along the way.

### Organisations and outsiders

- **Everyone belongs to an organisation.** A sole trader gets a one-person organisation at
  sign-up.
- **Channels belong to an organisation and are either internal or open to outsiders.**
  Outsiders cannot be invited to an internal channel.
- **No guest types.** Slack Connect's external and single-channel guests were exactly what
  made it unpleasant.

### Cost

- **Smooo pays for the AI. No bring-your-own-key.** ChatGPT and Claude subscriptions do not
  include an API key, so BYOK would not spare anyone a second bill anyway.
- **Free plan: a monthly cap on posts. Paid plan: a monthly fee that includes a cap, then
  pay for what goes over.**
- **Caps are counted per organisation.** Each AI's posts come out of its owner's
  organisation. Usage per person varies by orders of magnitude — about one post a day to a
  thousand — and pooling absorbs that.
- **Most of the cost is input.** Keep what the model reads down to posts in the same topic.

### Model for rewriting messages

**Sonnet 5 (`claude-sonnet-5`, effort low).** Compared with Haiku 4.5 in `evals/format/` on
2026-09-26.

| | Haiku 4.5 | Sonnet 5 |
|---|---|---|
| Clear failures on 30 unseen inputs, first run | 3 | 0 |
| Cost per message | $0.00076 | $0.00153 |

Sonnet 5 turned out to be less clean than its first run suggested; see below.

Haiku kept failing even after the prompt forbade it: it answered "？" with a note about having
nothing to rewrite, swapped a manager and their report, and greeted a client with
「お疲れ様です」. The note would have been posted as the person's own message.

**One run per case measures luck, not the prompt.** On 2026-09-26 the exact prompt that scored
0 clear failures on `cases2.json` scored 2–3 on a rerun, including the note-to-self kind
(「上司(社内)への文面です。」 posted as the message). Run `cases2.json` three times
(`ONLY=sonnet`) and read all of it.

**The rewrite comes back as JSON, `{ "message": ... }`.** Three runs of `cases2.json` in this
mode (`results_v5_unseen_json_run*.md`, 90 outputs): no notes-to-self, one clear failure
(「？」 answered with a made-up request to confirm something).

**Who is inside and who is outside goes in the recipient line, not the system prompt.** In a
channel with outsiders, the line lists colleagues and outsiders and says: address colleagues
as colleagues, never add a name the input did not use (`mixedAudience` in `format.ts`, same
text in `cases_mixed.json`). Putting that rule in the system prompt made the model deliberate
about addressees on every internal message too, and write the deliberation into the post.

The prompt is `src/lib/ai/format-system.md`, shared by the app and `evals/format/run.py`. After
changing it, run `cases2.json` as well —
`cases.json` was in view while the prompt was written, so scores on it read high.

## Open questions

- Whether "don't state a fact you cannot point to a source for; ask instead" becomes a fixed
  rule, separate from the threshold.
- Who uses it first.
- When to send notifications.
- The screen structure. The reply quote is a placeholder.
- Whether an in-app calendar ships at launch. If it does, Google Calendar is read-only and
  Smooo's events reach Google Calendar through an iCal feed it subscribes to.

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
