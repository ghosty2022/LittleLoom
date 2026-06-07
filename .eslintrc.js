module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    'react/jsx-curly-brace-presence': ['error', 'never'],
    '@typescript-eslint/no-extra-semi': 'error',
    'no-unexpected-multiline': 'error',
  },
};