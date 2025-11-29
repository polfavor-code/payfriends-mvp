const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for PayFriends E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
    // Test directory
    testDir: './e2e',

    // Maximum time one test can run
    timeout: 30 * 1000,

    // Run tests in files in parallel
    fullyParallel: true,

    // Fail the build on CI if you accidentally left test.only in the source code
    forbidOnly: !!process.env.CI,

    // Retry failed tests on CI
    retries: process.env.CI ? 2 : 0,

    // Opt out of parallel tests on CI
    workers: process.env.CI ? 1 : undefined,

    // Reporter to use
    reporter: 'html',

    // Shared settings for all tests
    use: {
        // Base URL for tests
        baseURL: 'http://localhost:3000',

        // Collect trace when retrying failed tests
        trace: 'on-first-retry',

        // Screenshot on failure
        screenshot: 'only-on-failure',

        // Video on failure
        video: 'retain-on-failure',
    },

    // Configure projects for major browsers
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // Run dev server before starting tests
    webServer: {
        command: 'npm run dev',
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000, // 2 minutes to start
    },
});
