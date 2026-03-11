/**
 * Configuration ESLint pour le service Auth
 * Règles : no-console warn, no-unused-vars avec exception pour catch (_err), globals Node + Jest.
 */
import globals from 'globals';
import pluginJs from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,  // Ajoute process, __dirname, etc.
        ...globals.jest,  // Ajoute describe, it, expect, etc. pour les tests
      },
    },
    rules: {
      'no-console': 'warn',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // Ignore les variables commençant par _
      'no-undef': 'error',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'  // Ignore catch (_err)
      }],
    },
  },
  pluginJs.configs.recommended,
];