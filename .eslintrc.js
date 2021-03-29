/** @type {import('eslint').Linter.Config} */
const config = {
    ignorePatterns: ['**/dist/**'],
    extends: ['iamyth/preset/node'],
    parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname
    }
};

module.exports = config;