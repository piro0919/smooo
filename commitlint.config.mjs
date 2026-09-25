// コミットは Conventional Commits（feat / fix / docs / chore ...）
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // 件名に英語の固有名詞（Sonnet、Supabase など）が入るので、大文字小文字は縛らない
    "subject-case": [0],
    "body-max-line-length": [0],
  },
};

export default config;
