# Smooo

A chat app where you can't post your own words.

It looks like Slack — organisations, channels, DMs — but nothing you type goes out as typed.
Everyone has an AI. You type whatever you want to say, however roughly, and your AI posts it as
a polished message. When someone asks you something, your AI answers from what it knows about
you. Only when it can't does it come back to you with a question you answer in one tap.

The point is not saving you the writing. It is saving you the reading and the deciding: the
back-and-forth over dates, the "did you send it yet?", the replies nobody needed.

It is in Japanese and still local only.

## What it does

- **Rewrites every post.** What you typed stays visible to you alone; the channel sees the
  rewrite. Colleagues get colleague Japanese and clients get client Japanese, even in the same
  channel.
- **Answers for you, or asks you first.** How much it may decide on its own is your setting:
  careful, standard, or trusting. Questions show up under the post that caused them.
- **Keeps the conversation moving.** AIs answer each other for a few turns, react instead of
  sending thank-yous, and answer for you when you let a question run past its deadline.
- **Remembers.** Your answers become its memory. What it learned in a client channel stays in
  that channel. Correct one of your posts and it forgets what the correction contradicts.
- **Slack-shaped basics.** Channels internal or open to outsiders, DMs, invite links, unread
  channels in bold, avatars, a phone layout, installable as a web app.

## Run it

Needs Docker and the Supabase CLI.

```sh
npm install
supabase start
cp .env.example .env.local   # fill in the keys from `supabase status -o env`
npm run dev                  # http://127.0.0.1:3000 — not localhost
```

Next.js 16, React 19, Tailwind 4, shadcn/ui on Base UI, Supabase for sign-in, Postgres, storage
and realtime, Claude Sonnet 5 for everything the AI does.

Posting needs `ANTHROPIC_API_KEY`, and every post costs a few model calls. Without the key the
app still runs; posts fail to go out.

To look around without Google sign-in, make a local test user and use the dev-only door:

```sh
SUPABASE_SECRET_KEY=... node --env-file=.env.local scripts/dev-session.mjs a@example.test
open "http://127.0.0.1:3000/auth/dev?email=a@example.test"
```

## Checks

Commits run ESLint, TypeScript, and secretlint through lefthook. CI adds a build and the
database tests.

```sh
npm run test:db    # pgTAP: who can see and write what
```

The AI's behaviour is measured in `evals/`: `format/` for the rewriting, `decide/` for when it
answers or asks. Each run calls the model many times and costs real money — check the numbers
in `CLAUDE.md` first.

## License

MIT
