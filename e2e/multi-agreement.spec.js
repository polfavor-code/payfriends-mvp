const { test, expect } = require('@playwright/test');

const BORROWER_EMAIL = 'borrower@test.dev';
const BORROWER_PASSWORD = 'password123';

test.describe('Multi-Agreement Selection', () => {
    test('should show agreement selection page when multiple active agreements exist', async ({ page }) => {
        // Login
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

        await page.goto('/login.html');
        await page.fill('input[type="email"]', BORROWER_EMAIL);
        await page.fill('input[type="password"]', BORROWER_PASSWORD);
        await page.click('button[type="submit"]');

        // Check for error message
        try {
            await page.waitForSelector('#login-status.error', { timeout: 2000 });
            const errorText = await page.textContent('#login-status');
            console.log(`LOGIN ERROR: ${errorText}`);
        } catch (e) {
            // No error message found, continue waiting for redirect
        }

        await page.waitForURL('/app');

        // Click "Report a payment"
        await page.click('#report-payment-btn');

        // Expect redirect to selection page
        await page.waitForURL(/\/report-payment-select/);
        expect(page.url()).toContain('report-payment-select');

        // Verify selection page UI
        try {
            await expect(page.locator('h1')).toContainText('Select agreement');
        } catch (e) {
            console.log('PAGE CONTENT DUMP:');
            console.log(await page.content());
            throw e;
        }

        // Wait for loading to finish
        await expect(page.locator('#loading')).not.toBeVisible();

        // Check if empty state is visible
        if (await page.locator('#empty-state').isVisible()) {
            console.log('EMPTY STATE VISIBLE');
        }

        // Should have at least 2 agreements
        const cards = page.locator('.agreement-card');
        const cardCount = await cards.count();
        expect(cardCount).toBeGreaterThanOrEqual(2);
        console.log(`Found ${cardCount} agreements`);

        // Verify content of cards
        await expect(cards.first()).toBeVisible();
        await expect(cards.nth(1)).toBeVisible();

        // One should be "Demo loan 1" and other "Demo loan 2"
        // We can check for amounts since they are different (€1,000 vs €2,500)
        const amounts = await cards.locator('.detail-value').allTextContents();
        const has1000 = amounts.some(t => t.includes('1.000,00'));
        const has2500 = amounts.some(t => t.includes('2.500,00'));

        expect(has1000).toBeTruthy();
        expect(has2500).toBeTruthy();

        // Select the "Demo loan 1" agreement (the one with €1,000)
        // We need to find the card that contains the text "1.000,00"
        const card1000 = cards.filter({ hasText: '1.000,00' });
        await card1000.click();

        // Expect redirect to report payment form for that agreement
        await page.waitForURL(/\/agreements\/\d+\/report-payment/);

        // Verify we are on the correct page
        const url = page.url();
        expect(url).toMatch(/\/agreements\/\d+\/report-payment/);

        // Verify context shows €1,000
        await expect(page.locator('#context-amount')).toContainText('1.000');
    });
});
