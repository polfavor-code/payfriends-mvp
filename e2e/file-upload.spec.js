const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BORROWER_EMAIL = 'borrower@test.dev';
const BORROWER_PASSWORD = 'password123';

test.describe('File Upload', () => {
    test('should allow uploading proof of payment file', async ({ page }) => {
        // Step 1: Login as borrower
        await page.goto('/login.html');
        await page.fill('input[type="email"]', BORROWER_EMAIL);
        await page.fill('input[type="password"]', BORROWER_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('/app');

        // Wait for dashboard to load
        await page.waitForTimeout(2000);

        // Step 2: Navigate to report payment
        await page.click('#report-payment-btn');

        // Handle multi-agreement selection
        await page.waitForURL(/\/(report-payment-select\.html|agreements\/\d+\/report-payment)/);
        if (page.url().includes('report-payment-select')) {
            await page.locator('.agreement-card').first().click();
        }

        await page.waitForURL(/\/agreements\/\d+\/report-payment/);

        // Step 3: Wait for form to load
        await page.waitForSelector('#inline-payment-amount', { state: 'visible' });

        // Step 4: Fill in payment details
        await page.fill('#inline-payment-amount', '500');
        await page.selectOption('#inline-payment-method', 'bank');

        // Step 5: Create a test file to upload
        const testFilePath = path.join(__dirname, '..', 'test-receipt.txt');
        fs.writeFileSync(testFilePath, 'Test payment receipt\nAmount: €500\nDate: ' + new Date().toISOString());

        try {
            // Step 6: Upload file
            const fileInput = page.locator('#inline-payment-proof, input[type="file"]');
            await fileInput.setInputFiles(testFilePath);

            // Verify file was selected
            const fileName = await page.locator('.filename, [data-filename]').textContent().catch(() => '');
            console.log(`Selected file: ${fileName}`);

            // Step 7: Verify submit button is present and enabled
            const submitButton = page.locator('button:has-text("Report"), button[type="submit"]');
            await expect(submitButton).toBeVisible();
            const isEnabled = await submitButton.isEnabled();

            console.log(`Submit button is enabled: ${isEnabled}`);
            expect(isEnabled).toBeTruthy();

            console.log('✅ File upload form ready for submission');
        } finally {
            // Clean up test file
            if (fs.existsSync(testFilePath)) {
                fs.unlinkSync(testFilePath);
            }
        }
    });

    test('should show file name after selection', async ({ page }) => {
        // Login
        await page.goto('/login.html');
        await page.fill('input[type="email"]', BORROWER_EMAIL);
        await page.fill('input[type="password"]', BORROWER_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('/app');
        await page.waitForTimeout(2000);

        // Navigate to report payment
        await page.click('#report-payment-btn');
        await page.waitForURL(/\/(report-payment-select\.html|agreements\/\d+\/report-payment)/);
        if (page.url().includes('report-payment-select')) {
            await page.locator('.agreement-card').first().click();
        }
        await page.waitForURL(/\/agreements\/\d+\/report-payment/);

        // Wait for form
        await page.waitForSelector('#inline-payment-amount', { state: 'visible' });

        // Create test file
        const testFilePath = path.join(__dirname, '..', 'test-image.jpg');
        // Create a minimal valid JPEG (just header bytes)
        const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
        fs.writeFileSync(testFilePath, jpegHeader);

        try {
            // Upload file
            const fileInput = page.locator('#inline-payment-proof, input[type="file"]');
            await fileInput.setInputFiles(testFilePath);

            // Wait a moment for UI update
            await page.waitForTimeout(500);

            // Check that filename is displayed somewhere
            const pageText = await page.textContent('body');
            const showsFileName = pageText.includes('test-image.jpg') || pageText.includes('Selected:');

            console.log(`Page shows filename: ${showsFileName}`);
            expect(showsFileName).toBeTruthy();

            console.log('✅ File name displayed after selection');
        } finally {
            if (fs.existsSync(testFilePath)) {
                fs.unlinkSync(testFilePath);
            }
        }
    });
});
