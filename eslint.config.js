// ESLint flat config (ESLint v9+)
// Migrado desde .eslintrc.cjs al nuevo formato flat config.
// Cubre TypeScript (@typescript-eslint) + React / React Hooks / React Native.

const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactNative = require('eslint-plugin-react-native');
const globals = require('globals');

module.exports = [
  // Equivalente a ignorePatterns del antiguo .eslintrc.cjs
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'expo-env.d.ts',
    ],
  },

  // Reglas base de JavaScript (eslint:recommended)
  js.configs.recommended,

  // Ficheros de configuración / scripts en JS (CommonJS, entorno Node)
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },

  // Código de la app: TypeScript + React Native
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
        ecmaVersion: 2022,
      },
      globals: {
        ...globals.es2022,
        ...globals.node,
        ...globals.browser,
        __DEV__: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-native': reactNative,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // @typescript-eslint/recommended (equivalente al extends antiguo)
      ...tseslint.configs.recommended.rules,

      // Permite marcar args/vars intencionadamente sin usar con el prefijo "_"
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // React + nuevo transform JSX (React 19, sin necesidad de importar React)
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native
      'react-native/no-unused-styles': 'warn',
      'react-native/no-single-element-style-arrays': 'warn',

      // En TypeScript, los tipos ya cubren no-undef; evita falsos positivos.
      'no-undef': 'off',
      // En un proyecto TS no se usan prop-types.
      'react/prop-types': 'off',
    },
  },
];
