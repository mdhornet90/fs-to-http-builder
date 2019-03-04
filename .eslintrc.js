module.exports = {
  env: {
    node: true,
    jest: true,
  },
  extends: ['airbnb-base', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'func-names': ['error', 'never'],
    'import/order': ['error', {'groups': ['builtin', 'external', 'parent', 'sibling', 'index'], 'newlines-between' : 'always'}],
    'no-param-reassign': ['error', { 'props': false }],
    'prettier/prettier': ['error'],
    'camelcase': 'off',
    'no-use-before-define': ['error', { 'functions': false }],
  },
  overrides: [
    {
      files: ['src/test-harness/**/*.js'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
        'import/prefer-default-export': 'off',
      }
    },
    {
      files: ['src/db/**/*.js', 'src/**/endpoints/**/*.js'],
      rules: {
        'import/prefer-default-export': 'off',
      }
    }
  ],
};