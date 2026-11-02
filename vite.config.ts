import { defineConfig } from 'vite-plus';

export default defineConfig({
    staged: {
        '*': 'vp check --fix',
    },
    fmt: {
        astro: true,
        singleQuote: true,
        trailingComma: 'all',
        tabWidth: 4,
    },
    lint: {
        // Keep the Oxlint defaults (unicorn, typescript, oxc) and add plugins
        // that match the app's stack: ESM imports, promises, and Vue SFCs.
        plugins: ['unicorn', 'typescript', 'oxc', 'import', 'promise', 'vue'],
        jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
        categories: {
            correctness: 'error',
            suspicious: 'warn',
            nursery: 'warn',
            perf: 'warn',
        },
        overrides: [
            {
                files: ['**/*.astro'],
                globals: {
                    Astro: 'readonly',
                },
            },
        ],
        env: {
            browser: true,
        },
        ignorePatterns: ['dist/**', '.astro/**'],
        rules: {
            'vite-plus/prefer-vite-plus-imports': 'error',
            // TypeScript
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            // General
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'no-alert': 'error',
            'no-debugger': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            'no-console': ['warn', { allow: ['debug', 'info', 'warn', 'error'] }],
            // Imports
            'import/no-cycle': 'error',
            'import/no-duplicates': 'error',
            'import/no-self-import': 'error',
            'import/no-unassigned-import': ['error', { allow: ['**/*.css'] }],
            // Promises
            'promise/no-return-wrap': 'error',
            'promise/param-names': 'warn',
            // Retry loops deliberately await sequentially between backoff delays.
            'no-await-in-loop': 'off',
        },
        options: { typeAware: true, typeCheck: true },
    },
});
