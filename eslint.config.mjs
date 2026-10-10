import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import magicNumbers from "@piro0919/eslint-config";
import tailwind from "@piro0919/eslint-config/tailwind";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 名前の無い数字と Tailwind の [...] を警告する（全リポジトリで共有する piro0919/eslint-config）
  ...magicNumbers(),
  ...tailwind({ cssConfigPath: "src/app/globals.css" }),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
