/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals: {
        SpreadsheetApp: "readonly",
        Logger: "readonly",
        ScriptApp: "readonly",
        UrlFetchApp: "readonly",
        Utilities: "readonly",
        PropertiesService: "readonly",
        HtmlService: "readonly",
        GoogleAppsScript: "readonly",
        GoogleCloud: "readonly",
        GoogleAds: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        google: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
      }
    },
    plugins: {
      "@typescript-eslint": ts,
      "prettier": prettier,
    },
    rules: {
      ...ts.configs.recommended.rules,
      "prettier/prettier": "error",
      "no-undef": "error",
    },
  },
  eslintConfigPrettier,
  {
    ignores: [
      "node_modules/*",
      "build/*",
      "testing",
      "src/ui/dist/*",
      "template/**/*"
    ],
  }
];
