import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import jest from "eslint-plugin-jest";
import prettier from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**/*.ts"],
    ...jest.configs["flat/recommended"],
  },
  {
    ignores: ["lib/**", "node_modules/**"],
  }
);
