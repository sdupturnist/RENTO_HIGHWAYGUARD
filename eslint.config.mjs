import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import nextPlugin from "@next/eslint-plugin-next";

const compat = new FlatCompat({
  baseDirectory: process.cwd(),
});

export default defineConfig([
  ...compat.config(nextPlugin.configs["core-web-vitals"]),
  globalIgnores([
    ".next/**",
    "out/**",
    "next-env.d.ts",
  ]),
]);
