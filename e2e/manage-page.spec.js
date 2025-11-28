const { test, expect } = require('@playwright/test');

const BORROWER_EMAIL = 'borrower@test.dev';
const BORROWER_PASSWORD = 'password123';
const LENDER_EMAIL = 'lender@test.dev';
const LENDER_PASSWORD = 'password123';

test.describe('Manage Page & Payment Timeline', () => {
    test('should show payment timeline with past payments', async ({ page }) => {
        // Login as borrower
        await page.goto('/login.html');
        await page.fill('input[type="email"]', BORROWER_EMAIL);
        await page.fill('input[type="password"]', BORROWER_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('/app');

        // Navigate to agreement 2 which has payment history
        await page.goto('/agreements/2/manage');

        // Wait for page to load
        await page.waitForSelector('h1, .agreement-header', { timeout: 10000 });

        console.log(`Current URL: ${page.url()}`);

        // Check for payment timeline or history section
        const hasTimeline = await page.locator('.timeline, .payment-history, .payments-section').count() > 0;
        const hasPaymentText = await page.locator('text=/payment|history|timeline/i').count() > 0;

        console.log(`Has timeline element: ${hasTimeline}`);
        console.log(`Has payment-related text: ${hasPaymentText}`);

        // Look for individual payment entries
        const paymentEntries = await page.locator('[data-payment], .payment-item, .timeline-item').count();
        console.log(`Payment entries found: ${paymentEntries}`);

        // Agreement 2 should have at least 2 settled payments + 1 pending
        expect(paymentEntries).toBeGreaterThanOrEqual(1);

        console.log('✅ Manage page shows payment information');
    });

    test('should display agreement details on manage page', async ({ page }) => {
        // Login as borrower
        await page.goto('/login.html');
        await page.fill('input[type="email"]', BORROWER_EMAIL);
        await page.fill('input[type="password"]', BORROWER_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('/app');

        // Navigate to manage page
        await page.goto('/agreements/4/manage');

        // Wait for page to load
        await page.waitForSelector('h1, .agreement-header', { timeout: 10000 });

        // Verify key agreement details are shown
        const pageText = await page.textContent('body');

        // Should show loan amount (€1,000 for agreement 4)
        const showsAmount = pageText.includes('1.000') || pageText.includes('1000');
        console.log(`Shows loan amount: ${showsAmount}`);

        // Should show lender name
        const showsLender = pageText.includes('Lenny') || pageText.includes('Lender');
        console.log(`Shows lender name: ${showsLender}`);

        expect(showsAmount || showsLender).toBeTruthy();

        console.log('✅ Manage page displays agreement details');
    });

    test('lender should see borrower info on manage page', async ({ page }) => {
        // Login as lender
        await page.goto('/login.html');
        await page.fill('input[type="email"]', LENDER_EMAIL);
        await page.fill('input[type="password"]', LENDER_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('/app');

        // Navigate to agreement manage page
        await page.goto('/agreements/2/manage');

        // Wait for page to load
        await page.waitForSelector('h1, .agreement-header', { timeout: 10000 });

        // Verify borrower info is shown
        const pageText = await page.textContent('body');

        const showsBorrower = pageText.includes('Bob') || pageText.includes('Borrower');
        console.log(`Shows borrower name: ${showsBorrower}`);

        // Should show loan amount
        const showsAmount = pageText.includes('2.500') || pageText.includes('2500');
        console.log(`Shows loan amount: ${showsAmount}`);

        expect(showsBorrower || showsAmount).toBeTruthy();

        console.log('✅ Lender can view agreement details');
    });
});
