const PROD = process.env.NODE_ENV === 'production';

module.exports = {
    root: true,
    env: {
        browser: true,
        node: true,
        jest: true,
        es2022: true,
    },
    globals: {
        JSX: true,
    },
    extends: [
        'eslint:recommended',
        'prettier',
        'plugin:prettier/recommended',
        'plugin:@next/next/recommended',
    ],
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        'prettier',
        'react',
        'import',
        'eslint-plugin-node',
    ],
    ignorePatterns: ['./typings', './next', './node_modules'],
    rules: {
        'jsx-a11y/alt-text': 'off',
        '@next/next/no-html-link-for-pages': ['error', 'pages/'],
        '@next/next/no-img-element': 'off',
        camelcase: 'error',
        'react/jsx-no-literals': 'error',
        'no-eval': 'error',
        'import/first': 'error',
        '@typescript-eslint/explicit-function-return-type': 'off',
        'react-hooks/exhaustive-deps': 'off',
        '@typescript-eslint/no-unused-vars': [
            'error',
            {
                argsIgnorePattern: '^_',
                ignoreRestSiblings: true,
            },
        ],
        'no-unused-vars': [
            'error',
            {
                argsIgnorePattern: '^_',
                ignoreRestSiblings: true,
            },
        ],
        'react/prop-types': 'off',
        'no-console': [
            PROD ? 'error' : 'off',
            {
                allow: ['warn', 'error', 'info'],
            },
        ],
        'no-debugger': PROD ? 'error' : 'off',
        'import/order': [
            'error',
            {
                groups: [
                    'builtin',
                    'external',
                    ['internal', 'unknown'],
                    'parent',
                    ['sibling', 'index'],
                ],
                'newlines-between': 'always',
            },
        ],
        'prettier/prettier': [
            'error',
            {
                endOfLine: 'auto',
            },
        ],
    },
};
