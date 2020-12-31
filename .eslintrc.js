module.exports = {
  env: {
    node: true,
    jest: true,
  },
  extends: ['airbnb-base', 'prettier'],
  plugins: ['prettier'],
  parser: 'babel-eslint',
  rules: {
    'func-names': ['error', 'never'],
    'import/order': ['error', {'groups': ['builtin', 'external', 'parent', 'sibling', 'index'], 'newlines-between' : 'always'}],
    'no-param-reassign': ['error', { 'props': false }],
    'prettier/prettier': ['error'],
    'camelcase': 'off',
    'no-use-before-define': ['error', { 'functions': false }],
    'import/no-extraneous-dependencies': ['error', {'devDependencies': ['**/*.test.mjs']}]
  }
};
