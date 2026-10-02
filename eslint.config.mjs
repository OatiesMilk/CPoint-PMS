import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// MVC layer rules (see CLAUDE.md and docs/prompts/system-rebuild.md → <architecture>).
// Type-only imports of generated Prisma types are allowed everywhere.
const prismaOnlyInModels = {
  group: ["@/generated/prisma", "@/generated/prisma/*", "@/server/lib/prisma"],
  allowTypeImports: true,
  message: "Only src/server/models/** may use Prisma. Go through a service.",
};
const noModels = {
  group: ["@/server/models/*"],
  message: "Call a service instead of a model.",
};
const noControllers = {
  group: ["@/server/controllers/*"],
  message: "Only src/app/api/**/route.ts may import controllers.",
};
const noServer = {
  group: ["@/server/*"],
  message: "Components receive data through props; pages and server actions call services.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["src/app/**/*.{ts,tsx}"],
    ignores: ["src/app/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [prismaOnlyInModels, noModels, noControllers] },
      ],
    },
  },
  {
    files: ["src/app/api/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [prismaOnlyInModels, noModels] }],
    },
  },
  {
    files: ["src/server/controllers/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [prismaOnlyInModels, noModels] }],
    },
  },
  {
    files: [
      "src/server/services/**/*.ts",
      "src/server/validators/**/*.ts",
      "src/server/policies/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [prismaOnlyInModels, noControllers] }],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [prismaOnlyInModels, noServer] }],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
