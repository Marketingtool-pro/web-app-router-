import { fixupConfigRules } from '@eslint/compat';
import prettier from 'eslint-plugin-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import js from '@eslint/js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  // GLOBAL ignores. In ESLint flat config `ignores` is only global when it is
  // the ONLY key in the object — put it beside `files` and it merely narrows
  // that one config. That mistake is easy to make and silently does nothing.
  //
  // `pnpm run lint` is `eslint .`, so without this ESLint walks the built
  // bundle and reports errors from minified rolldown output. Measured
  // 2026-09-13: 129 error-level problems, 58 of them inside dist/.
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.claude/**',
      '**/*.min.js'
    ]
  },

  ...fixupConfigRules(compat.extends('prettier')),

  {
    plugins: {
      prettier,
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y
    },

    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },

    settings: {
      react: {
        version: 'detect'
      }
    },

    rules: {
      'react/jsx-filename-extension': 'off',
      'no-param-reassign': 'off',
      'react/prop-types': 'off',
      'react/require-default-props': 'off',
      'react/no-array-index-key': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-props-no-spreading': 'off',
      'import/order': 'off',
      'no-console': 'off',
      'no-shadow': 'off',
      'import/no-cycle': 'off',
      'import/no-extraneous-dependencies': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/no-autofocus': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      'no-restricted-imports': [
        'error',
        {
          patterns: ['@mui/*/*/*', '!@mui/material/test-utils/*']
        }
      ],

      // 'warn', not 'error', and deliberately so.
      //
      // In this codebase an unused identifier is usually an UNFINISHED FEATURE,
      // not dead code. Reports is the clearest example — its seven unused
      // symbols are IconFileSpreadsheet (export), IconClock (scheduling),
      // IconTrash and IconEdit (row actions), Alert (error display), and the
      // setPlatforms / setSelectedMetrics state setters that make its filters
      // inert. That matches the note in CLAUDE.md that reports/ and chart/
      // contain no backend call despite being listed as done.
      //
      // The same pattern has bitten before and each time the answer was to WIRE
      // THE THING UP, not delete it: AiInsights, LockedPageOverlay and
      // checkSubscription were all found unused and then connected.
      //
      // At 'error' this blocks CI on work in progress, which pushes people to
      // delete the evidence to get green. At 'warn' the list stays queryable
      // (eslint src -f json) and gets resolved page by page as each page is
      // finished.
      'no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'none'
        }
      ],

      'prettier/prettier': 'warn'
    }
  },
  {
    ignores: ['node_modules/**'],
    files: ['src/**/*.{js,jsx}']
  }
];
