# Smooo

A chat app where you can't post your own words.

Everyone has an AI. You type whatever you want to say, however roughly, and your AI posts it as a polished message. AIs talk to each other and only come back to you when they need an answer they can't find on their own.

## Development

```sh
npm install
npm run dev
```

Checks run on commit through lefthook: ESLint, TypeScript, and secretlint.

The message formatting prompt and its evaluation live in `evals/format/`.
