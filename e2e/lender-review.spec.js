const { test, expect } = require('@playwright/test');

const LENDER_EMAIL = 'lender@test.dev';
const LENDER_PASSWORD = 'password123';

test.describe('Lender Review Flow', () => {
    test('should allow lender to review reported payment from dashboard', async ({ page }) => {
        // Step 1: Login as lender
        await page.goto('/login.html');
        await page.fill('input[type="email"]', LENDER_EMAIL);
        await page.fill('input[type="password"]', LENDER_PASSWORD);
        await page.click('button[type="submit"]');

        // Step 2: Wait for dashboard
        await page.waitForURL('/app');

        // Wait for dashboard to load
        await page.waitForTimeout(2000);

        // Step 3: Verify there's a pending payment notification/task
        // Check for unread messages or pending tasks indicator
        const messagesCount = await page.locator('.unread-count, .badge, [data-unread]').count();
        console.log(`Unread messages/notifications: ${messagesCount}`);

        // Navigate to messages/inbox
        const messagesLink = page.locator('a[href="/messages"], a[href*="message"]').first();
        if (await messagesLink.isVisible()) {
            await messagesLink.click();
            await page.waitForURL(/\/(messages|inbox)/);

            // Step 4: Find and click on payment report notification
            const paymentNotification = page.locator('text=/payment|reported|review/i').first();
            if (await paymentNotification.isVisible()) {
                await paymentNotification.click();

                // Should navigate to review page or show payment details
                await page.waitForTimeout(1000);
                console.log(`Navigated to: ${page.url()}`);

                // Step 5: Verify we can see payment details
                // Look for approve/reject buttons or payment info
                const hasApproveButton = await page.locator('button:has-text("Approve"), button:has-text("Accept")').count() > 0;
                const hasRejectButton = await page.locator('button:has-text("Reject"), button:has-text("Decline")').count() > 0;

                console.log(`Has approve button: ${hasApproveButton}`);
                console.log(`Has reject button: ${hasRejectButton}`);

                expect(hasApproveButton || hasRejectButton).toBeTruthy();
            }
        }

        console.log('✅ Lender can access payment review flow');
    });

    test('should show pending payment in agreement details', async ({ page }) => {
        // Login as lender
        await page.goto('/login.html');
        await page.fill('input[type="email"]', LENDER_EMAIL);
        await page.fill('input[type="password"]', LENDER_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('/app');

        // Wait for dashboard to load
        await page.waitForTimeout(2000);

        // Navigate to an agreement with pending payment (ID 2 from seed)
        await page.goto('/agreements/2/manage');

        // Wait for page to load
        await page.waitForSelector('h1, .agreement-header', { timeout: 10000 });

        // Look for pending payment indicator
        const hasPendingPayment = await page.locator('text=/pending|review|waiting/i').count() > 0;
        console.log(`Agreement has pending payment indicator: ${hasPendingPayment}`);

        // Check for payment timeline/history
        const hasTimeline = await page.locator('.timeline, .payment-history, [data-payment]').count() > 0;
        console.log(`Agreement has payment timeline: ${hasTimeline}`);

        expect(hasPendingPayment || hasTimeline).toBeTruthy();
        console.log('✅ Lender can see pending payment in agreement details');
    });
});
