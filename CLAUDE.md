@AGENTS.md

# Smooo

Looks like an ordinary chat app, except that people cannot post their own words. The spec was
settled in one long discussion on 2026-09-26. So far there is sign-in, organisations, and
channels; nothing can be posted yet.

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
| `src/app/o/[orgId]/` | The Slack-shaped screen: organisation rail, channel list, channel |
| `evals/format/` | The prompt that rewrites what people type, and how it was chosen |
| `scripts/dev-session.mjs` | Makes a local test user and prints its session cookie, to check screens without Google |

## Local development

- **Supabase runs locally.** The free plan allows two active projects and Spatto and Chappie
  hold both, so the cloud project gets created right before launch, on the paid plan that
  launch needs anyway. Migrations are the source of truth, so moving is just applying them.
- **Ports are 553xx, not 543xx,** so Spatto's local stack can run at the same time.
- **Open the app at `http://127.0.0.1:3000`, not `localhost`.** Supabase redirects back to
  127.0.0.1, and a session cookie set on one host is invisible on the other. `next.config.ts`
  allows 127.0.0.1 as a dev origin; without it Next blocks its own hot reload socket and the
  page never hydrates, so buttons silently do nothing.
- **Checking a screen without Google:** run `scripts/dev-session.mjs` with `SUPABASE_SECRET_KEY`
  from `supabase status -o env`, and hand the printed cookie to the browser. It refuses to talk
  to anything but 127.0.0.1.
- **Who sees what is decided in Postgres, not in pages.** Membership checks live in
  `private.*` functions so policies do not recurse, and a trigger — not a policy — keeps
  outsiders out of internal channels, so an invite path added later cannot open a hole.
- **Everyone gets a personal organisation at sign-up.** A company organisation is joined later
  by invitation, which does not exist yet.

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
- **Posts are never edited.** A correction is a new post.
- **Reactions are the AI's job too.**
- **Channels and DMs, like Slack.** The AI keeps track of which topic each post belongs to;
  the screen only shows a quote of the post being replied to. This is provisional.

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
| Clear failures on 30 unseen inputs | 3 | 0 |
| Cost per message | $0.00076 | $0.00153 |

Haiku kept failing even after the prompt forbade it: it answered "？" with a note about having
nothing to rewrite, swapped a manager and their report, and greeted a client with
「お疲れ様です」. The note would have been posted as the person's own message.

The prompt is `SYSTEM` in `evals/format/run.py`. After changing it, run `cases2.json` as well —
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
