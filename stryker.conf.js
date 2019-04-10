module.exports = config => {
  config.set({
    packageManager: 'yarn',
    reporters: ['progress', 'html', 'clear-text', 'dashboard'],
    testRunner: 'jest',
    coverageAnalysis: 'off',
    thresholds: { break: 75 },
  });
};
