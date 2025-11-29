const { test, expect } = require('@playwright/test');

/**
 * E2E Test: Report a Payment from Dashboard
 * 
 * Prerequisites: Run `npm run seed:demo` to create test data
 * 
 * Tests the happy path for reporting a payment:
 * 1. Login as borrower
 * 2. Click "Report a payment" from dashboard
 * 3. Fill out payment form
 * 4. Submit and verify success
 */

// Test user credentials (from seed script)
const BORROWER_EMAIL = 'borrower@test.dev';
const BORROWER_PASSWORD = 'password123';

test.describe('Report a Payment', () => {
    test('should allow borrower to report payment from dashboard', async ({ page }) => {
        // Step 1: Navigate to login page
        await page.goto('/login.html');

        // Debug: Print console logs
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

        // Step 2: Fill in login credentials (clear first to avoid prefilled values)
        const emailInput = page.locator('#login-email');
        const passwordInput = page.locator('#login-password');
        await emailInput.click();
        await emailInput.fill('');
        await emailInput.fill(BORROWER_EMAIL);
        await passwordInput.click();
        await passwordInput.fill('');
        await passwordInput.fill(BORROWER_PASSWORD);

        // Step 3: Click login button
        await page.click('button[type="submit"]');

        // Step 4: Wait for redirect to dashboard
        await page.waitForURL('/app');

        // Verify we're on the dashboard
        await expect(page).toHaveURL('/app');

        // Step 5: Wait for dashboard to load and verify "Report a payment" button exists
        const reportPaymentBtn = page.locator('#report-payment-btn');
        await expect(reportPaymentBtn).toBeVisible({ timeout: 10000 });

        // Wait for dashboard JavaScript to fully initialize
        await page.waitForTimeout(2000);

        // Step 6: Click "Report a payment" button
        await reportPaymentBtn.click();

        // Step 7: Handle multi-agreement selection if needed
        // Wait for either the selection page or direct to report payment
        await page.waitForURL(/\/(report-payment-select\.html|agreements\/\d+\/report-payment)/);

        // If we're on the selection page, select the first agreement
        if (page.url().includes('report-payment-select')) {
            const firstCard = page.locator('.agreement-card').first();
            await firstCard.click();
            await page.waitForURL(/\/agreements\/\d+\/report-payment/);
        }

        // Verify we're on the report payment page
        expect(page.url()).toMatch(/\/agreements\/\d+\/report-payment/);

        // Step 8: Wait for form to load
        await page.waitForSelector('#inline-payment-amount', { state: 'visible' });

        // Step 9: Fill in payment amount
        // Use €500 as test amount
        await page.fill('#inline-payment-amount', '500');

        // Step 10: Select payment method
        // Wait for the dropdown to be populated
        await page.waitForTimeout(500);
        await page.selectOption('#inline-payment-method', 'bank');

        // Step 11: Optional - Add a note
        await page.fill('#inline-payment-note', 'E2E test payment');

        // Step 12: Optional - Skip file upload for now
        // TODO: Add file upload test when needed
        // const fileInput = page.locator('#inline-payment-proof');
        // await fileInput.setInputFiles('./test-fixtures/dummy-proof.jpg');

        // Step 13: Submit the form
        const submitButton = page.locator('#inline-payment-submit');
        await submitButton.click();

        // Step 14: Wait for success message or redirect
        // The component shows "Payment reported successfully! Redirecting..." then redirects to /app
        const statusEl = page.locator('#inline-payment-status');

        // Wait for either success status or redirect to dashboard
        await Promise.race([
            statusEl.locator('.success').waitFor({ timeout: 5000 }).catch(() => { }),
            page.waitForURL('/app', { timeout: 5000 }).catch(() => { })
        ]);

        // Wait a bit for redirect if not already there
        await page.waitForTimeout(1500);

        // Step 15: Verify we're back on dashboard or see success message
        const currentUrl = page.url();
        const isOnDashboard = currentUrl.includes('/app');
        const hasSuccessStatus = await statusEl.locator('.success').count() > 0;

        // At least one should be true
        expect(isOnDashboard || hasSuccessStatus).toBeTruthy();

        // If on dashboard, verify we can see the timeline or agreements section
        if (isOnDashboard) {
            // Look for timeline or active agreements indicator
            const dashboardContent = page.locator('#dashboard-main');
            await expect(dashboardContent).toBeVisible({ timeout: 5000 });
        }

        console.log('✅ Payment reported successfully via E2E test');
    });

    test('should show agreement context on report payment page', async ({ page }) => {
        // Login
        await page.goto('/login.html');
        const emailInput = page.locator('#login-email');
        const passwordInput = page.locator('#login-password');
        await emailInput.click();
        await emailInput.fill('');
        await emailInput.fill(BORROWER_EMAIL);
        await passwordInput.click();
        await passwordInput.fill('');
        await passwordInput.fill(BORROWER_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('/app');

        // Wait for dashboard to fully load
        const reportPaymentBtn = page.locator('#report-payment-btn');
        await expect(reportPaymentBtn).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        // Click report payment
        await page.click('#report-payment-btn');

        // Handle multi-agreement selection if needed
        await page.waitForURL(/\/(report-payment-select\.html|agreements\/\d+\/report-payment)/);
        if (page.url().includes('report-payment-select')) {
            await page.locator('.agreement-card').first().click();
        }

        await page.waitForURL(/\/agreements\/\d+\/report-payment/);

        // Verify agreement context card is visible
        const contextCard = page.locator('#agreement-context');
        await expect(contextCard).toBeVisible();

        // Verify lender name is shown
        const lenderName = page.locator('#context-lender');
        await expect(lenderName).toContainText('Lenny Lender');

        // Verify borrower name is shown
        const borrowerName = page.locator('#context-borrower');
        await expect(borrowerName).toContainText('Bob Borrower');

        // Verify loan amount is shown
        const amount = page.locator('#context-amount');
        await expect(amount).toContainText('2.500'); // €2,500 (agreement ID 2)

        console.log('✅ Agreement context displayed correctly');
    });

    test('should show autofill link for amount due today', async ({ page }) => {
        // Login
        await page.goto('/login.html');
        const emailInput = page.locator('#login-email');
        const passwordInput = page.locator('#login-password');
        await emailInput.click();
        await emailInput.fill('');
        await emailInput.fill(BORROWER_EMAIL);
        await passwordInput.click();
        await passwordInput.fill('');
        await passwordInput.fill(BORROWER_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('/app');

        // Wait for dashboard to fully load
        const reportPaymentBtn = page.locator('#report-payment-btn');
        await expect(reportPaymentBtn).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        // Click report payment
        await page.click('#report-payment-btn');

        // Handle multi-agreement selection if needed
        await page.waitForURL(/\/(report-payment-select\.html|agreements\/\d+\/report-payment)/);
        if (page.url().includes('report-payment-select')) {
            await page.locator('.agreement-card').first().click();
        }

        await page.waitForURL(/\/agreements\/\d+\/report-payment/);

        // Verify autofill link exists
        const autofillLink = page.locator('#autofill-amount-link');
        await expect(autofillLink).toBeVisible();
        await expect(autofillLink).toContainText('Use amount due today');

        // Click autofill link
        await autofillLink.click();

        // Verify amount input is filled
        const amountInput = page.locator('#inline-payment-amount');
        const value = await amountInput.inputValue();

        // Should have some value (the calculated amount due)
        expect(parseFloat(value)).toBeGreaterThan(0);

        console.log(`✅ Autofill link works - filled with €${value}`);
    });
});
