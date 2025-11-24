/**
 * Legal Pages Content
 * Contains HTML templates and render functions for all legal pages
 */

(function() {
  'use strict';

  // Helper function to get the legal content container
  function getLegalContainer() {
    return document.getElementById('legal-content');
  }

  // Render Legal Index Page
  function renderLegalIndex() {
    const container = getLegalContainer();
    if (!container) return;

    container.innerHTML = `
      <style>
        .legal-page-title { font-size: 28px; font-weight: 600; margin: 0 0 24px 0; }
        .legal-card { background: var(--card); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px; margin: 16px 0; }
        .legal-section-title { font-size: 18px; font-weight: 600; margin: 0 0 16px 0; color: var(--text); }
        .legal-section-description { color: var(--muted); font-size: 14px; margin-bottom: 20px; line-height: 1.6; }
        .legal-link-style { color: var(--accent); text-decoration: none; cursor: pointer; }
        .legal-link-style:hover { text-decoration: underline; }
        .legal-row { margin: 20px 0; }
      </style>

      <h1 class="legal-page-title">Legal Information</h1>

      <div class="legal-card">
        <h2 class="legal-section-title">About PayFriends</h2>
        <p class="legal-section-description">
          PayFriends is a simple, private tool that helps you set up and track personal loans between friends and family.
          It helps users create clear agreements, repayment schedules and friendly reminders so everyone knows where they stand.
        </p>
        <p class="legal-section-description">
          PayFriends is not a bank, lender or financial institution. We do not hold money, process payments, extend credit
          or give financial, legal or tax advice. All loans and repayments happen directly between users, outside our platform.
          The app only supports record keeping, transparency and communication.
        </p>
      </div>

      <div class="legal-card">
        <h2 class="legal-section-title">Legal Documents</h2>
        <p class="legal-section-description">Please review our legal documents to understand how PayFriends works and how we protect your information.</p>

        <div class="legal-row">
          <div style="color:var(--muted); font-size:14px; line-height:2">
            <div><a href="/app/legal/terms" class="legal-link-style">Terms of Service</a> — Learn what PayFriends does and your responsibilities</div>
            <div><a href="/app/legal/privacy" class="legal-link-style">Privacy Policy</a> — Understand how we collect, use, and protect your data</div>
            <div><a href="/app/legal/cookies" class="legal-link-style">Cookie Notice</a> — See what cookies we use and why</div>
          </div>
        </div>
      </div>
    `;
  }

  // Render Terms of Service Page
  function renderTerms() {
    const container = getLegalContainer();
    if (!container) return;

    container.innerHTML = `
      <style>
        .legal-back-link { display: inline-block; margin-bottom: 16px; font-size: 14px; color: var(--accent); text-decoration: none; }
        .legal-back-link:hover { text-decoration: underline; }
        .legal-page-title { font-size: 28px; font-weight: 600; margin: 0 0 8px 0; }
        .legal-last-updated { color: var(--muted); font-size: 13px; font-style: italic; margin-bottom: 16px; }
        .legal-card { background: var(--card); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px; margin: 16px 0; }
        .legal-content { line-height: 1.7; font-size: 14px; }
        .legal-content h3 { font-size: 16px; font-weight: 600; margin: 24px 0 12px 0; color: var(--text); }
        .legal-content p { margin: 12px 0; color: var(--text); }
        .legal-content ul, .legal-content ol { margin: 12px 0; padding-left: 24px; }
        .legal-content li { margin: 8px 0; color: var(--text); }
        .legal-content strong { font-weight: 600; color: var(--text); }
        .legal-link-style { color: var(--accent); text-decoration: none; }
        .legal-link-style:hover { text-decoration: underline; }
      </style>

      <a href="/app/legal" class="legal-back-link">← Back to Legal Information</a>

      <h1 class="legal-page-title">Terms of Service</h1>
      <p class="legal-last-updated">Last updated: January 2025</p>

      <div class="legal-card">
        <div class="legal-content">
          <h3>1. Introduction</h3>
          <p>
            Welcome to PayFriends. By accessing or using the PayFriends platform (the "Service"), you agree to be bound by these Terms of Service (these "Terms"). If you do not agree to these Terms, you may not use the Service.
          </p>
          <p>
            PayFriends is owned and operated by PayFriends ("we," "us," or "our"). These Terms constitute a legally binding agreement between you and PayFriends.
          </p>

          <h3>2. What PayFriends Does</h3>
          <p>PayFriends is a personal loan tracking and record-keeping tool. Specifically, PayFriends:</p>
          <ul>
            <li>Allows you to record details of loans you have made to friends or family</li>
            <li>Helps you track loan balances, payments, and repayment schedules</li>
            <li>Provides a simple interface to manage and communicate about existing loans</li>
            <li>Stores and displays your loan records for your personal reference</li>
          </ul>

          <h3>3. What PayFriends Does NOT Do</h3>
          <p>PayFriends is not a financial institution, lender, or payment processor. We explicitly do NOT:</p>
          <ul>
            <li>Provide loans, credit, or any form of financing</li>
            <li>Facilitate money transfers or payments of any kind</li>
            <li>Collect, hold, or transmit money on your behalf</li>
            <li>Report to credit bureaus or affect credit scores</li>
            <li>Create legally binding loan contracts (though we may help you document existing agreements)</li>
            <li>Provide financial, legal, or tax advice</li>
            <li>Guarantee loan repayment or offer collection services</li>
            <li>Act as an intermediary in your loan transactions</li>
          </ul>
          <p>
            All loans tracked through PayFriends are arranged, funded, and repaid entirely outside of our platform. PayFriends is simply a tool to help you remember and organize information about loans that you have already made independently.
          </p>

          <h3>4. Eligibility</h3>
          <p>You must be at least 18 years old to use PayFriends. By using the Service, you represent and warrant that:</p>
          <ul>
            <li>You are at least 18 years of age</li>
            <li>You have the legal capacity to enter into these Terms</li>
            <li>All information you provide to us is accurate and truthful</li>
            <li>You will comply with all applicable laws when using the Service</li>
          </ul>

          <h3>5. User Responsibilities</h3>
          <p>When using PayFriends, you agree to:</p>
          <ul>
            <li>Keep your account credentials secure and confidential</li>
            <li>Ensure all loan information you enter is accurate to the best of your knowledge</li>
            <li>Use the Service only for lawful purposes</li>
            <li>Not use the Service to track illegal transactions or activities</li>
            <li>Not attempt to access other users' accounts or data</li>
            <li>Not reverse engineer, copy, or misuse our software or technology</li>
            <li>Comply with all applicable laws regarding loans, lending, and record-keeping in your jurisdiction</li>
          </ul>
          <p>
            You are solely responsible for the loans you make and track using PayFriends. We have no involvement in your lending decisions or loan terms.
          </p>

          <h3>6. No Financial Advice</h3>
          <p>
            PayFriends does not provide financial, legal, or tax advice. Any information, tools, or features provided through the Service are for informational purposes only. You should consult with qualified professionals before making any financial or legal decisions.
          </p>
          <p>
            We do not endorse or recommend any particular loan terms, interest rates, or lending practices. All lending decisions and terms are entirely your responsibility.
          </p>

          <h3>7. Privacy</h3>
          <p>
            Your privacy is important to us. Our <a href="/app/legal/privacy" class="legal-link-style">Privacy Policy</a> explains how we collect, use, and protect your personal information. By using PayFriends, you also agree to our Privacy Policy.
          </p>

          <h3>8. Prohibited Use</h3>
          <p>You may not use PayFriends to:</p>
          <ul>
            <li>Track illegal loans or transactions</li>
            <li>Violate any laws or regulations, including lending and usury laws</li>
            <li>Engage in fraud, money laundering, or other illegal activities</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Upload malware, viruses, or malicious code</li>
            <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
            <li>Use automated tools or bots to access or use the Service</li>
          </ul>
          <p>
            We reserve the right to suspend or terminate your account if we believe you are violating these Terms or engaging in prohibited activities.
          </p>

          <h3>9. Reliability of the Service</h3>
          <p>
            While we strive to make PayFriends reliable and available, we provide the Service on an "as is" and "as available" basis. We do not guarantee that the Service will always be available, error-free, or secure.
          </p>
          <p>
            You are responsible for maintaining your own backup records of important loan information. We are not liable for any data loss, service interruptions, or technical errors.
          </p>

          <h3>10. Liability</h3>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, PAYFRIENDS AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
          </p>
          <p>
            IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU EXCEED THE AMOUNT YOU HAVE PAID TO US IN THE TWELVE (12) MONTHS PRIOR TO THE EVENT GIVING RISE TO THE CLAIM.
          </p>
          <p>
            You acknowledge that PayFriends is not responsible for:
          </p>
          <ul>
            <li>Whether your borrowers repay their loans</li>
            <li>Disputes between you and your borrowers</li>
            <li>The legal enforceability of your loans</li>
            <li>Tax implications of your lending activities</li>
            <li>Compliance with local lending or usury laws</li>
          </ul>

          <h3>11. Modification of Terms</h3>
          <p>
            We may update these Terms from time to time. We will notify you of material changes by posting a notice on our platform or sending you an email. Your continued use of PayFriends after such changes constitutes your acceptance of the updated Terms.
          </p>
          <p>
            If you do not agree with the updated Terms, you should stop using the Service and may request deletion of your account.
          </p>

          <h3>12. Termination</h3>
          <p>
            You may stop using PayFriends at any time and request deletion of your account.
          </p>
          <p>
            We may suspend or terminate your access to the Service at any time, with or without notice, if we believe you have violated these Terms or for any other reason at our sole discretion.
          </p>

          <h3>13. Governing Law and Disputes</h3>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which PayFriends operates, without regard to its conflict of law provisions.
          </p>
          <p>
            Any disputes arising from these Terms or your use of the Service shall be resolved through good faith negotiation. If negotiation fails, disputes may be resolved through binding arbitration or in the courts of competent jurisdiction.
          </p>

          <h3>14. Severability</h3>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
          </p>

          <h3>15. Entire Agreement</h3>
          <p>
            These Terms, together with our Privacy Policy and Cookie Notice, constitute the entire agreement between you and PayFriends regarding the use of the Service.
          </p>
        </div>
      </div>
    `;
  }

  // Render Privacy Policy Page
  function renderPrivacy() {
    const container = getLegalContainer();
    if (!container) return;

    container.innerHTML = `
      <style>
        .legal-back-link { display: inline-block; margin-bottom: 16px; font-size: 14px; color: var(--accent); text-decoration: none; }
        .legal-back-link:hover { text-decoration: underline; }
        .legal-page-title { font-size: 28px; font-weight: 600; margin: 0 0 8px 0; }
        .legal-last-updated { color: var(--muted); font-size: 13px; font-style: italic; margin-bottom: 16px; }
        .legal-card { background: var(--card); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px; margin: 16px 0; }
        .legal-content { line-height: 1.7; font-size: 14px; }
        .legal-content h3 { font-size: 16px; font-weight: 600; margin: 24px 0 12px 0; color: var(--text); }
        .legal-content p { margin: 12px 0; color: var(--text); }
        .legal-content ul, .legal-content ol { margin: 12px 0; padding-left: 24px; }
        .legal-content li { margin: 8px 0; color: var(--text); }
        .legal-content strong { font-weight: 600; color: var(--text); }
        .legal-link-style { color: var(--accent); text-decoration: none; }
        .legal-link-style:hover { text-decoration: underline; }
      </style>

      <a href="/app/legal" class="legal-back-link">← Back to Legal Information</a>

      <h1 class="legal-page-title">Privacy Policy</h1>
      <p class="legal-last-updated">Last updated: January 2025</p>

      <div class="legal-card">
        <div class="legal-content">
          <h3>1. Introduction</h3>
          <p>
            PayFriends ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our loan tracking service (the "Service").
          </p>
          <p>
            By using PayFriends, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with this Privacy Policy, please do not use our Service.
          </p>

          <h3>2. Information We Collect</h3>
          <p>We collect several types of information to provide and improve our Service:</p>

          <p><strong>Account Information</strong></p>
          <ul>
            <li>Name</li>
            <li>Email address</li>
            <li>Phone number</li>
            <li>Password (stored securely using industry-standard encryption)</li>
            <li>Profile photo (optional)</li>
          </ul>

          <p><strong>Loan Data</strong></p>
          <ul>
            <li>Loan amounts and balances</li>
            <li>Borrower names and contact information</li>
            <li>Loan terms (interest rates, due dates, payment schedules)</li>
            <li>Payment history and transaction records</li>
            <li>Notes and communications related to loans</li>
            <li>Signed agreements and documentation</li>
          </ul>

          <p><strong>Usage Data</strong></p>
          <ul>
            <li>Device information (browser type, operating system)</li>
            <li>IP address</li>
            <li>Login times and activity logs</li>
            <li>Pages visited and features used</li>
            <li>Error logs and diagnostic information</li>
          </ul>

          <h3>3. How We Use Your Information</h3>
          <p>We use the information we collect for the following purposes:</p>

          <p><strong>To Provide the Service</strong></p>
          <ul>
            <li>Create and manage your account</li>
            <li>Store and display your loan records</li>
            <li>Enable communication features between you and your borrowers</li>
            <li>Calculate loan balances, interest, and payment schedules</li>
            <li>Send notifications about loan activity and updates</li>
          </ul>

          <p><strong>To Improve and Maintain the Service</strong></p>
          <ul>
            <li>Analyze usage patterns to improve features and user experience</li>
            <li>Monitor and troubleshoot technical issues</li>
            <li>Prevent fraud and enhance security</li>
            <li>Conduct testing and quality assurance</li>
          </ul>

          <p><strong>To Communicate With You</strong></p>
          <ul>
            <li>Send important service updates and notifications</li>
            <li>Respond to your inquiries and support requests</li>
            <li>Inform you of changes to our Terms or Privacy Policy</li>
          </ul>

          <h3>4. How We Share Your Information</h3>
          <p>
            We respect your privacy and do not sell your personal information to third parties. We only share your information in the following limited circumstances:
          </p>

          <p><strong>With Your Borrowers</strong></p>
          <ul>
            <li>When you invite someone to track a loan, we share relevant loan details and your contact information with that person</li>
            <li>Loan records and payment information are visible to both you and the borrower for that specific loan</li>
          </ul>

          <p><strong>With Service Providers</strong></p>
          <ul>
            <li>We may use trusted third-party service providers to help operate our Service (e.g., hosting, email delivery, analytics)</li>
            <li>These providers are contractually obligated to protect your information and may only use it to provide services to us</li>
          </ul>

          <p><strong>For Legal Reasons</strong></p>
          <ul>
            <li>We may disclose your information if required by law, court order, or government request</li>
            <li>We may share information to protect our rights, property, or safety, or that of our users or the public</li>
            <li>We may share information to detect, prevent, or address fraud, security, or technical issues</li>
          </ul>

          <p><strong>Business Transfers</strong></p>
          <ul>
            <li>If PayFriends is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction</li>
          </ul>

          <h3>5. What We Do NOT Do With Your Information</h3>
          <p>We want to be clear about what we do not do:</p>
          <ul>
            <li><strong>We never sell your data</strong> to advertisers, data brokers, or other third parties</li>
            <li><strong>We do not share your loan data</strong> with credit bureaus or financial institutions</li>
            <li><strong>We do not use your information</strong> for targeted advertising outside of our Service</li>
            <li><strong>We do not track you</strong> across other websites or apps</li>
          </ul>

          <h3>6. Data Security</h3>
          <p>
            We take data security seriously and implement appropriate technical and organizational measures to protect your information from unauthorized access, disclosure, alteration, or destruction.
          </p>
          <p>Security measures include:</p>
          <ul>
            <li>Encryption of data in transit (HTTPS/TLS)</li>
            <li>Encryption of sensitive data at rest</li>
            <li>Secure password hashing using industry-standard algorithms</li>
            <li>Regular security audits and updates</li>
            <li>Access controls and authentication requirements</li>
          </ul>
          <p>
            However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
          </p>

          <h3>7. Data Retention</h3>
          <p>
            We retain your personal information for as long as your account is active or as needed to provide you with the Service. If you delete your account, we will delete or anonymize your personal information within 90 days, unless we are required to retain it for legal or regulatory reasons.
          </p>
          <p>
            Some information may be retained in backup systems for a limited period before being permanently deleted.
          </p>

          <h3>8. Your Rights and Choices</h3>
          <p>You have the following rights regarding your personal information:</p>

          <p><strong>Access and Portability</strong></p>
          <ul>
            <li>You can access your personal information at any time through your account settings</li>
            <li>You can request a copy of your data in a portable format by contacting us</li>
          </ul>

          <p><strong>Correction</strong></p>
          <ul>
            <li>You can update your account information at any time through your profile settings</li>
            <li>If you believe any information we hold is inaccurate, you can request corrections</li>
          </ul>

          <p><strong>Deletion</strong></p>
          <ul>
            <li>You can delete your account and associated data at any time</li>
            <li>Some information may be retained as required by law or for legitimate business purposes</li>
          </ul>

          <p><strong>Opt-Out</strong></p>
          <ul>
            <li>You can opt out of non-essential email communications by adjusting your notification settings</li>
            <li>Note that we may still send you essential service-related communications</li>
          </ul>

          <h3>9. GDPR Rights (For European Users)</h3>
          <p>
            If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR):
          </p>
          <ul>
            <li><strong>Right to Access:</strong> Request confirmation of what personal data we process and obtain a copy</li>
            <li><strong>Right to Rectification:</strong> Request correction of inaccurate personal data</li>
            <li><strong>Right to Erasure:</strong> Request deletion of your personal data in certain circumstances</li>
            <li><strong>Right to Restriction:</strong> Request that we limit how we use your data</li>
            <li><strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
            <li><strong>Right to Object:</strong> Object to our processing of your personal data</li>
            <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time where processing is based on consent</li>
          </ul>

          <h3>10. Children's Privacy</h3>
          <p>
            PayFriends is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child under 18, we will take steps to delete that information promptly.
          </p>

          <h3>11. International Data Transfers</h3>
          <p>
            Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. By using PayFriends, you consent to the transfer of your information to these countries.
          </p>
          <p>
            We take steps to ensure that your data receives an adequate level of protection wherever it is processed.
          </p>

          <h3>12. Cookies and Tracking</h3>
          <p>
            We use cookies and similar tracking technologies to operate and improve our Service. For more information about the cookies we use, please see our <a href="/app/legal/cookies" class="legal-link-style">Cookie Notice</a>.
          </p>

          <h3>13. Third-Party Links</h3>
          <p>
            Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any information to them.
          </p>

          <h3>14. Changes to This Privacy Policy</h3>
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes by posting the updated policy on this page and updating the "Last updated" date.
          </p>
          <p>
            We encourage you to review this Privacy Policy periodically. Your continued use of PayFriends after changes are posted constitutes your acceptance of the updated Privacy Policy.
          </p>
        </div>
      </div>
    `;
  }

  // Render Cookie Notice Page
  function renderCookies() {
    const container = getLegalContainer();
    if (!container) return;

    container.innerHTML = `
      <style>
        .legal-back-link { display: inline-block; margin-bottom: 16px; font-size: 14px; color: var(--accent); text-decoration: none; }
        .legal-back-link:hover { text-decoration: underline; }
        .legal-page-title { font-size: 28px; font-weight: 600; margin: 0 0 8px 0; }
        .legal-last-updated { color: var(--muted); font-size: 13px; font-style: italic; margin-bottom: 16px; }
        .legal-card { background: var(--card); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px; margin: 16px 0; }
        .legal-content { line-height: 1.7; font-size: 14px; }
        .legal-content h3 { font-size: 16px; font-weight: 600; margin: 24px 0 12px 0; color: var(--text); }
        .legal-content p { margin: 12px 0; color: var(--text); }
        .legal-content ul, .legal-content ol { margin: 12px 0; padding-left: 24px; }
        .legal-content li { margin: 8px 0; color: var(--text); }
        .legal-content strong { font-weight: 600; color: var(--text); }
        .legal-content table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .legal-content th, .legal-content td { border: 1px solid rgba(255,255,255,0.1); padding: 12px; text-align: left; }
        .legal-content th { background: rgba(255,255,255,0.05); font-weight: 600; }
        .legal-link-style { color: var(--accent); text-decoration: none; }
        .legal-link-style:hover { text-decoration: underline; }
      </style>

      <a href="/app/legal" class="legal-back-link">← Back to Legal Information</a>

      <h1 class="legal-page-title">Cookie Notice</h1>
      <p class="legal-last-updated">Last updated: January 2025</p>

      <div class="legal-card">
        <div class="legal-content">
          <h3>1. What Are Cookies?</h3>
          <p>
            Cookies are small text files that are placed on your device when you visit a website. They help websites remember information about your visit, such as your preferences and login status, making your experience more efficient and personalized.
          </p>
          <p>
            Cookies do not contain viruses or malware and cannot access or read other files on your device. They can only be read by the website that created them.
          </p>

          <h3>2. How PayFriends Uses Cookies</h3>
          <p>
            PayFriends uses cookies to provide essential functionality and improve your experience. We believe in minimal, privacy-respecting tracking, so we only use cookies that are necessary for the Service to function properly.
          </p>

          <h3>3. Types of Cookies We Use</h3>

          <p><strong>Strictly Necessary Cookies</strong></p>
          <p>
            These cookies are essential for the operation of PayFriends. Without these cookies, the Service would not function properly. These cookies include:
          </p>
          <ul>
            <li><strong>Authentication cookies:</strong> Keep you logged in as you navigate between pages</li>
            <li><strong>Session cookies:</strong> Maintain your session state and temporary data</li>
            <li><strong>Security cookies:</strong> Help protect your account from unauthorized access</li>
          </ul>
          <p>
            Because these cookies are essential for the Service, they cannot be disabled if you want to use PayFriends.
          </p>

          <p><strong>Functional Cookies</strong></p>
          <p>
            These cookies remember your preferences and choices to provide a more personalized experience. For example:
          </p>
          <ul>
            <li>Language preferences</li>
            <li>Display settings and layout choices</li>
            <li>Notification preferences</li>
          </ul>

          <h3>4. What We Do NOT Use</h3>
          <p>
            We want to be transparent about what we do not do:
          </p>
          <ul>
            <li><strong>No advertising cookies:</strong> We do not use cookies for advertising or marketing purposes</li>
            <li><strong>No third-party tracking:</strong> We do not allow third-party advertisers or data brokers to place cookies on our site</li>
            <li><strong>No cross-site tracking:</strong> We do not track your activity across other websites</li>
            <li><strong>No social media tracking:</strong> We do not use social media tracking pixels or similar technologies</li>
          </ul>

          <h3>5. Cookie Details</h3>
          <p>Below is a summary of the cookies we use:</p>

          <table>
            <thead>
              <tr>
                <th>Cookie Name</th>
                <th>Purpose</th>
                <th>Type</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>session_token</td>
                <td>Authenticates your login session</td>
                <td>Essential</td>
                <td>30 days or until logout</td>
              </tr>
              <tr>
                <td>csrf_token</td>
                <td>Protects against cross-site request forgery attacks</td>
                <td>Security</td>
                <td>Session (deleted when browser closes)</td>
              </tr>
              <tr>
                <td>user_prefs</td>
                <td>Stores your display and notification preferences</td>
                <td>Functional</td>
                <td>1 year</td>
              </tr>
            </tbody>
          </table>

          <h3>6. How to Control Cookies</h3>
          <p>
            You have several options for managing cookies:
          </p>

          <p><strong>Browser Settings</strong></p>
          <p>
            Most web browsers allow you to control cookies through their settings. You can typically:
          </p>
          <ul>
            <li>View what cookies are stored and delete them individually</li>
            <li>Block third-party cookies</li>
            <li>Block all cookies from specific websites</li>
            <li>Delete all cookies when you close your browser</li>
            <li>Block all cookies (note: this will prevent you from using PayFriends)</li>
          </ul>

          <p><strong>How to Access Cookie Settings in Popular Browsers:</strong></p>
          <ul>
            <li><strong>Google Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
            <li><strong>Mozilla Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
            <li><strong>Safari:</strong> Preferences → Privacy → Cookies and website data</li>
            <li><strong>Microsoft Edge:</strong> Settings → Cookies and site permissions → Cookies and site data</li>
          </ul>

          <p><strong>Important Note</strong></p>
          <p>
            If you block or delete cookies, some features of PayFriends may not work properly. In particular, you will not be able to stay logged in or use essential features of the Service.
          </p>

          <h3>7. Do Not Track</h3>
          <p>
            Some browsers include a "Do Not Track" (DNT) feature that signals to websites that you do not want to be tracked. Because we do not use tracking or advertising cookies, enabling DNT will not change how PayFriends operates.
          </p>

          <h3>8. Local Storage and Similar Technologies</h3>
          <p>
            In addition to cookies, PayFriends may use similar technologies such as:
          </p>
          <ul>
            <li><strong>Local Storage:</strong> Used to store larger amounts of data locally on your device for faster performance</li>
            <li><strong>Session Storage:</strong> Temporary storage that is cleared when you close your browser tab</li>
          </ul>
          <p>
            These technologies serve similar purposes to cookies and are subject to the same privacy protections described in our <a href="/app/legal/privacy" class="legal-link-style">Privacy Policy</a>.
          </p>

          <h3>9. Updates to This Cookie Notice</h3>
          <p>
            We may update this Cookie Notice from time to time to reflect changes in our use of cookies or legal requirements. We will post any updates on this page with a revised "Last updated" date.
          </p>
          <p>
            We encourage you to review this Cookie Notice periodically to stay informed about how we use cookies.
          </p>
        </div>
      </div>
    `;
  }

  // Export render functions
  window.LegalPages = {
    renderLegalIndex,
    renderTerms,
    renderPrivacy,
    renderCookies
  };
})();
