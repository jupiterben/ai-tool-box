import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import svelteConfig from './svelte.config.js'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dist-electron',
      'src-tauri',
      '.svelte-check',
      '.cache',
      'test-results',
      'node_modules',
      'release',
      'docs',
      'scripts',
      '*.config.{js,ts,mjs}',
      'next-env.d.ts',
      'hook-doubao.js',
    ],
  },
  {
    files: ['**/*.{ts,svelte}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    rules: { 'prefer-const': 'off' },
    languageOptions: {
      parserOptions: { parser: tseslint.parser, svelteConfig },
    },
  },
  {
    files: ['**/*.svelte.ts'],
    languageOptions: { parser: tseslint.parser },
    rules: { 'prefer-const': 'off' },
  },
)
