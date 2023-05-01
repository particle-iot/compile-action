module.exports = {
    clearMocks: true,
    moduleFileExtensions: ['js', 'ts'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest'
    },
    transformIgnorePatterns: ['src/cparser/*.js'],
    verbose: true
};
