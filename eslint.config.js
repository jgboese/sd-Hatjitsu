// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    // Generated output
    'dist/',
    'playwright-report/',
    'test-results/',
    '.yarn/',
  ]),
  js.configs.recommended,
  {
    plugins: { 'unused-imports': unusedImports },
    rules: {
      'no-irregular-whitespace': 'error',
      'no-restricted-syntax': ['error', 'WithStatement'],
      'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
      'no-console': ['error', { allow: ['error'] }],
      'no-param-reassign': 'error',
      'no-new-wrappers': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      'dot-notation': 'error',
      'no-unused-private-class-members': 'error',
      'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
      'unused-imports/no-unused-imports': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    plugins: { jsdoc },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': 'allow-with-description' },
      ],
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      // Pairs with verbatimModuleSyntax: type-only imports must be marked so Node can strip them
      '@typescript-eslint/consistent-type-imports': 'error',
      'dot-notation': 'off',
      '@typescript-eslint/dot-notation': 'error',
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            ClassExpression: true,
            FunctionDeclaration: true,
            FunctionExpression: true,
          },
          contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration'],
        },
      ],
      'jsdoc/check-tag-names': 'error',
    },
  },
  {
    files: ['server/**/*.ts'],
    rules: {
      'no-console': ['error', { allow: ['info', 'error'] }],
    },
  },
  {
    files: ['**/*.test.ts', 'e2e/**', '*.config.ts', 'knip.ts'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
    },
  },
  {
    files: ['client/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/*'],
              allowTypeImports: true,
              message:
                'The client may only import types from the server; a value import would bundle server code (and zod) into the client.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  prettier,
]);
