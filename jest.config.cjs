module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',        // Matches "@/*" -> "src/*"
      '^~/(.*)$': '<rootDir>/$1',            // Matches "~/*" -> root directory
      '^Shared/(.*)$': '<rootDir>/Shared/$1' // Matches "Shared/*" -> "Shared/*"
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],  // Add this line
  };