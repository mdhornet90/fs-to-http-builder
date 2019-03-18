module.exports = config => {
  config.set({
    packageManager: 'yarn',
    reporters: ['progress', 'html', 'clear-text'],
    testRunner: 'jest',
    coverageAnalysis: 'off',
  });
};
