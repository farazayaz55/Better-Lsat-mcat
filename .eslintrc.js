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
    '.eslintrc.js',
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
    complexity: ['warn', { max: 20 }], // warn for complex functions
    'max-lines': 'off', // warn for long files
    'max-lines-per-function': 'off', // warn for long functions
    'max-depth': ['warn', 4], // warn for deep nesting
    'max-params': ['warn', 10], // warn for many parameters
    'max-statements': ['warn', 25], // warn for many statements

    /* ---- Naming & Conventions ---- */
    '@typescript-eslint/naming-convention': 'off', // disabled - too restrictive
    'unicorn/filename-case': 'warn', // disabled - too restrictive
    'unicorn/prevent-abbreviations': 'off', // disabled - too restrictive does not allow abbreviations

    /* ---- Code Quality / Best Practices ---- */
    eqeqeq: ['warn', 'always'], // changed from error to warn
    curly: ['warn', 'all'], // changed from error to warn
    'no-duplicate-imports': 'warn', // changed from error to warn
    'no-var': 'warn', // changed from error to warn
    'prefer-const': 'warn', // changed from error to warn
    'object-shorthand': 'warn', // changed from error to warn
    'arrow-body-style': 'off', // disabled - too restrictive // enforces functions in arrow only
    'no-magic-numbers': 'off', // disabled - too restrictive

    /* ---- DRY / Duplication ---- */
    'sonarjs/no-duplicate-string': 'off', // disabled - too restrictive
    'sonarjs/no-identical-functions': 'warn', // changed from error to warn
    'sonarjs/cognitive-complexity': 'warn', // disabled - too restrictive

    /* ---- Import Hygiene ---- */
    'import/no-cycle': 'warn', // changed from error to warn
    'import/no-duplicates': 'warn', // changed from error to warn
    'import/no-unresolved': 'warn',
    'import/order': 'off', // disabled - too restrictive

    /* ---- Security ---- */
    'security/detect-object-injection': 'warn', // allow safe object access
    'security/detect-non-literal-fs-filename': 'warn',

    /* ---- TypeScript Strictness ---- */
    '@typescript-eslint/explicit-function-return-type': 'warn', // disabled - too restrictive
    '@typescript-eslint/no-explicit-any': 'warn', // changed from error to warn
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // changed from error to warn
    '@typescript-eslint/no-inferrable-types': 'warn', // disabled - too restrictive
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/interface-name-prefix': 'off',

    /* ---- Unicorn Rules ---- */
    'unicorn/switch-case-braces': 'warn', // disabled - too restrictive
    'unicorn/prefer-number-properties': 'off', // disabled - too restrictive
    'unicorn/no-null': 'off', // disabled - too restrictive
    'unicorn/prefer-top-level-await': 'warn', // disabled - too restrictive
    'unicorn/prefer-set-has': 'off', // disabled - too restrictive
    'unicorn/prefer-ternary': 'warn', // disabled - too restrictive
    'unicorn/prefer-module': 'warn', // disabled - too restrictive
    'unicorn/no-await-expression-member': 'off', // disabled - too restrictive
    'unicorn/prefer-string-replace-all': 'off', // disabled - too restrictive
    'unicorn/better-regex': 'warn', // disabled - too restrictive

    /* ---- TypeScript Rules ---- */
    '@typescript-eslint/no-namespace': 'warn', // disabled - too restrictive
  },
};
