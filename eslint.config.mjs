import stylistic from '@stylistic/eslint-plugin';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

// The rules approximate the previously used TSLint config, i.e. tslint:recommended with the adaptations of the former
// tslint.json, on top of the recommended rules of ESLint, typescript-eslint and eslint-plugin-vue.
export default defineConfigWithVueTs(
    {
        // TSLint only linted TypeScript and Vue files.
        ignores: ['**/*.js'],
    },
    pluginVue.configs['flat/vue2-essential'],
    vueTsConfigs.recommended,
    {
        plugins: {
            '@stylistic': stylistic,
        },
        linterOptions: {
            // Some files contain directives for ESLint rules that are not enabled here.
            reportUnusedDisableDirectives: 'off',
        },
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            // Formatting
            '@stylistic/arrow-parens': ['error', 'always'],
            '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
            '@stylistic/comma-dangle': ['error', {
                arrays: 'always-multiline',
                objects: 'always-multiline',
                imports: 'always-multiline',
                exports: 'always-multiline',
                functions: 'always-multiline',
                enums: 'always-multiline',
                tuples: 'always-multiline',
                generics: 'ignore',
            }],
            '@stylistic/comma-spacing': 'error',
            '@stylistic/eol-last': 'error',
            '@stylistic/keyword-spacing': 'error',
            '@stylistic/max-len': ['error', 120],
            '@stylistic/new-parens': 'error',
            '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
            '@stylistic/no-tabs': 'error',
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/quote-props': ['error', 'consistent-as-needed'],
            '@stylistic/quotes': ['error', 'single', { allowTemplateLiterals: 'always' }],
            '@stylistic/rest-spread-spacing': 'error',
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/space-before-blocks': 'error',
            '@stylistic/space-before-function-paren': ['error', {
                anonymous: 'never',
                asyncArrow: 'always',
                named: 'never',
            }],
            '@stylistic/space-infix-ops': 'error',

            // Code style and correctness
            'curly': ['error', 'multi-line'],
            'dot-notation': 'error',
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'guard-for-in': 'error',
            'max-classes-per-file': ['error', 3],
            'no-bitwise': 'error',
            'no-caller': 'error',
            'no-console': 'off',
            'no-debugger': 'error',
            'no-eval': 'error',
            'no-new-wrappers': 'error',
            'no-throw-literal': 'error',
            'no-undef-init': 'error',
            'no-var': 'error',
            'object-shorthand': 'error',
            'one-var': ['error', 'never'],
            'prefer-arrow-callback': 'error',
            'prefer-const': 'error',
            'radix': 'error',
            '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
            '@typescript-eslint/consistent-type-assertions': 'error',
            '@typescript-eslint/explicit-member-accessibility': ['error', {
                overrides: { accessors: 'off', constructors: 'off', parameterProperties: 'off' },
            }],
            '@typescript-eslint/no-empty-function': 'error',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/no-shadow': 'error',
            '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true }],
            '@typescript-eslint/prefer-for-of': 'error',
            '@typescript-eslint/prefer-function-type': 'error',
            '@typescript-eslint/unified-signatures': 'error',
            '@typescript-eslint/naming-convention': ['error', {
                selector: ['variable', 'parameter'],
                format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                leadingUnderscore: 'allow',
            }],

            // Rules of the recommended configs, which TSLint did not check
            'prefer-spread': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-unsafe-declaration-merging': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/prefer-as-const': 'off',
            // Views that only forward requests to the Keyguard have empty templates.
            'vue/valid-template-root': 'off',
        },
    },
    {
        files: ['**/*.vue'],
        rules: {
            // Only check the line length of scripts, as TSLint did.
            '@stylistic/max-len': 'off',
            'vue/max-len': ['error', { code: 120, template: Number.MAX_SAFE_INTEGER }],
        },
    },
);
