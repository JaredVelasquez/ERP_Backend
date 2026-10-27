import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

const LAYERS = ['domain', 'application', 'infrastructure', 'presentation'];
const ALLOWED = {
  domain: [],
  application: ['domain'],
  infrastructure: ['domain', 'application'],
  presentation: ['domain', 'application'],
};

function layerRule(layer, extraAllowed = []) {
  const forbidden = LAYERS.filter((name) => name !== layer && !ALLOWED[layer].includes(name));
  const allowedPattern = extraAllowed.length === 0 ? '' : `(?!${extraAllowed.map((item) => item.replace('/', '\\/')).join('|')})`;
  return [
    'error',
    {
      patterns: [
        {
          regex: `^${allowedPattern}@(${forbidden.join('|')})/`,
          message: `Hexagonal architecture: ${layer} must not import from ${forbidden.join(', ')}.`,
        },
      ],
    },
  ];
}

const layerBlocks = LAYERS.map((layer) => ({
  files: [`libs/${layer}/src/**/*.ts`],
  ignores: layer === 'presentation' ? ['libs/presentation/src/**/*.module.ts'] : [],
  rules: { 'no-restricted-imports': layerRule(layer) },
}));

const presentationModuleBlock = {
  files: ['libs/presentation/src/**/*.module.ts'],
  rules: { 'no-restricted-imports': layerRule('presentation', ['@infrastructure/']) },
};

const presentationDatabaseBlock = {
  files: ['libs/presentation/src/**/*.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      { selector: 'CallExpression[callee.property.name="query"]', message: 'Presentation cannot execute database queries.' },
    ],
  },
};

export default [
  eslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: 'IfStatement[alternate]', message: 'Use early return or early throw instead of else.' },
        { selector: 'IfStatement IfStatement', message: 'Extract nested conditions into a named function.' },
        { selector: 'Property[key.name="synchronize"][value.value=true]', message: 'TypeORM schema synchronization is forbidden.' },
        { selector: 'Property[key.name="migrationsRun"][value.value=true]', message: 'Automatic TypeORM migrations are forbidden.' },
      ],
    },
  },
  ...layerBlocks,
  presentationModuleBlock,
  presentationDatabaseBlock,
];
