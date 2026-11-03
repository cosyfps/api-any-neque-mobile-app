// .eslintrc.js
module.exports = {
  root: true,
  extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  plugins: ['@typescript-eslint', 'import'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.server.json'],
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-non-null-assertion': 'warn',

    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          { pattern: '@app/**', group: 'internal', position: 'before' },
          { pattern: '@shared/**', group: 'internal', position: 'before' },
          { pattern: '@env/**', group: 'internal', position: 'before' },
          { pattern: '@testing/**', group: 'internal', position: 'before' },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-duplicates': 'error',

    'no-console': ['warn', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'always'],
  },
  overrides: [
    {
      // Los tests van tipados: ningun valor any y ningun jest.fn sin firma.
      files: ['**/*.spec.ts', 'src/testing/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unsafe-assignment': 'error',
        '@typescript-eslint/no-unsafe-member-access': 'error',
        '@typescript-eslint/no-unsafe-call': 'error',
        '@typescript-eslint/no-unsafe-return': 'error',
        '@typescript-eslint/no-unsafe-argument': 'error',
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "CallExpression[callee.object.name='jest'][callee.property.name='fn']:not([typeArguments])",
            message: 'Usa fn<F>() de @testing/typed-mock: jest.fn() sin firma es any.',
          },
        ],
      },
    },
  ],
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/', '.angular/', 'out-tsc/', '.vercel/'],
};
