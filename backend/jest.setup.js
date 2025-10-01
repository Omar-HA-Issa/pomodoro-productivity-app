// Jest setup file for test configuration
// This file runs before all tests

// Increase timeout for tests that involve database operations
jest.setTimeout(10000);

// Clean up after all tests complete
afterAll(() => {
  // Give time for any pending operations to complete
  return new Promise(resolve => setTimeout(resolve, 500));
});