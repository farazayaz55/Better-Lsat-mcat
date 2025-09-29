module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'simple-import-sort'],
  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:sonarjs/recommended',
    'plugin:unicorn/recommended',
    'plugin:import/recommended',
    'prettier',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  rules: {
    /* ---- Complexity / Maintainability ---- */
    complexity: ['error', { max: 10 }], // avoid over-complicated functions
    'max-lines': [
      'error',
      { max: 300, skipBlankLines: true, skipComments: true },
    ],
    'max-lines-per-function': [
      'error',
      { max: 50, skipBlankLines: true, skipComments: true },
    ],
    'max-depth': ['error', 3], // nesting levels
    'max-params': ['error', 4],
    'max-statements': ['error', 15],

    /* ---- Naming & Conventions ---- */
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'class', format: ['PascalCase'] },
      { selector: 'interface', format: ['PascalCase'], prefix: ['I'] },
      { selector: 'function', format: ['camelCase'] },
      { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
      { selector: 'enum', format: ['PascalCase'] },
      { selector: 'enumMember', format: ['UPPER_CASE'] },
      { selector: 'typeAlias', format: ['PascalCase'] },
      { selector: 'property', format: ['camelCase'] },
      { selector: 'method', format: ['camelCase'] },
    ],
    'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    'unicorn/prevent-abbreviations': [
      'error',
      { replacements: { props: false, ref: false } },
    ],

    /* ---- Code Quality / Best Practices ---- */
    'consistent-return': 'error',
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
    'no-console': 'warn',
    'no-duplicate-imports': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'object-shorthand': 'error',
    'arrow-body-style': ['error', 'as-needed'],
    'no-magic-numbers': [
      'warn',
      { ignore: [0, 1, -1], ignoreArrayIndexes: true },
    ],

    /* ---- DRY / Duplication ---- */
    'sonarjs/no-duplicate-string': 'warn',
    'sonarjs/no-identical-functions': 'error',
    'sonarjs/cognitive-complexity': ['error', 15],

    /* ---- Import Hygiene ---- */
    'import/no-cycle': 'error',
    'import/no-duplicates': 'error',
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
      },
    ],

    /* ---- Security ---- */
    'security/detect-object-injection': 'off', // allow safe object access
    'security/detect-non-literal-fs-filename': 'warn',

    /* ---- TypeScript Strictness ---- */
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      { allowExpressions: false },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-inferrable-types': 'error',
    '@typescript-eslint/explicit-member-accessibility': [
      'error',
      { accessibility: 'explicit' },
    ],
    '@typescript-eslint/interface-name-prefix': 'off',
    'simple-import-sort/imports': 'error',
    ignorePatterns: ['dist', 'node_modules'],
  },
};
