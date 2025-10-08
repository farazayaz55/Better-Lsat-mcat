module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint/eslint-plugin',
    // 'simple-import-sort',
    'sonarjs',
    'security',
  ],
  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:unicorn/recommended',
    'plugin:import/recommended',
    'prettier',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'test/**/*',
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/*.e2e-spec.ts',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
    },
  },
  rules: {
    /* ---- Complexity / Maintainability ---- */
    complexity: ['warn', { max: 15 }], // avoid over-complicated functions
    'max-lines': [
      'warn',
      { max: 400, skipBlankLines: true, skipComments: true },
    ],
    'max-lines-per-function': [
      'warn',
      { max: 80, skipBlankLines: true, skipComments: true },
    ],
    'max-depth': ['warn', 4], // nesting levels
    'max-params': ['warn', 6],
    'max-statements': ['warn', 25],

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
    'unicorn/filename-case': ['warn', { case: 'kebabCase' }],
    'unicorn/prevent-abbreviations': [
      'warn',
      {
        replacements: {
          props: false,
          ref: false,
          ctx: false,
          res: false,
          req: false,
          params: false,
          dto: false,
          spec: false,
          e2e: false,
        },
      },
    ],

    /* ---- Code Quality / Best Practices ---- */
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
    'no-duplicate-imports': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'object-shorthand': 'error',
    'arrow-body-style': ['error', 'as-needed'],
    'no-magic-numbers': [
      'warn',
      // { ignore: [0, 1, -1], ignoreArrayIndexes: true },
    ],

    /* ---- DRY / Duplication ---- */
    'sonarjs/no-duplicate-string': 'warn',
    'sonarjs/no-identical-functions': 'error',
    'sonarjs/cognitive-complexity': ['warn', 25],

    /* ---- Import Hygiene ---- */
    'import/no-cycle': 'error',
    'import/no-duplicates': 'error',
    'import/no-unresolved': 'warn',
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
        'newlines-between': 'never',
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
  },
};
