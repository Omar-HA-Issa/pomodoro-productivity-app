// Set environment variables for tests
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY || 'test-hf-key';

// Mock fetch globally for Hugging Face API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([[{ label: 'POSITIVE', score: 0.93 }]]),
    text: () => Promise.resolve(JSON.stringify([[{ label: 'POSITIVE', score: 0.93 }]])),
  })
);

// Silence console logs during tests in CI
if (process.env.CI) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  };
}