import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div>
      <Link href="/legal" className="inline-block mb-4 text-sm text-pf-accent no-underline hover:underline">
        ← Back to Legal Information
      </Link>

      <h1 className="text-[28px] font-semibold m-0 mb-2">Privacy Policy</h1>
      <p className="text-pf-muted text-[13px] italic mb-4">Last updated: January 2025</p>

      <div className="bg-pf-card border border-pf-card-border rounded-2xl p-6">
        <div className="text-sm leading-[1.7] text-pf-text">
          <h3 className="text-base font-semibold mt-6 mb-3 first:mt-0">1. Introduction</h3>
          <p className="my-3">
            PayFriends (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our loan tracking service (the &quot;Service&quot;).
          </p>
          <p className="my-3">
            By using PayFriends, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with this Privacy Policy, please do not use our Service.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">2. Information We Collect</h3>
          <p className="my-3">We collect several types of information to provide and improve our Service:</p>

          <p className="my-3"><strong className="font-semibold">Account Information</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Name</li>
            <li className="my-2">Email address</li>
            <li className="my-2">Phone number</li>
            <li className="my-2">Password (stored securely using industry-standard encryption)</li>
            <li className="my-2">Profile photo (optional)</li>
          </ul>

          <p className="my-3"><strong className="font-semibold">Loan Data</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Loan amounts and balances</li>
            <li className="my-2">Borrower names and contact information</li>
            <li className="my-2">Loan terms (interest rates, due dates, payment schedules)</li>
            <li className="my-2">Payment history and transaction records</li>
            <li className="my-2">Notes and communications related to loans</li>
            <li className="my-2">Signed agreements and documentation</li>
          </ul>

          <p className="my-3"><strong className="font-semibold">Usage Data</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Device information (browser type, operating system)</li>
            <li className="my-2">IP address</li>
            <li className="my-2">Login times and activity logs</li>
            <li className="my-2">Pages visited and features used</li>
            <li className="my-2">Error logs and diagnostic information</li>
          </ul>

          <h3 className="text-base font-semibold mt-6 mb-3">3. How We Use Your Information</h3>
          <p className="my-3">We use the information we collect for the following purposes:</p>

          <p className="my-3"><strong className="font-semibold">To Provide the Service</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Create and manage your account</li>
            <li className="my-2">Store and display your loan records</li>
            <li className="my-2">Enable communication features between you and your borrowers</li>
            <li className="my-2">Calculate loan balances, interest, and payment schedules</li>
            <li className="my-2">Send notifications about loan activity and updates</li>
          </ul>

          <p className="my-3"><strong className="font-semibold">To Improve and Maintain the Service</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Analyze usage patterns to improve features and user experience</li>
            <li className="my-2">Monitor and troubleshoot technical issues</li>
            <li className="my-2">Prevent fraud and enhance security</li>
            <li className="my-2">Conduct testing and quality assurance</li>
          </ul>

          <p className="my-3"><strong className="font-semibold">To Communicate With You</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Send important service updates and notifications</li>
            <li className="my-2">Respond to your inquiries and support requests</li>
            <li className="my-2">Inform you of changes to our Terms or Privacy Policy</li>
          </ul>

          <h3 className="text-base font-semibold mt-6 mb-3">4. How We Share Your Information</h3>
          <p className="my-3">
            We respect your privacy and do not sell your personal information to third parties. We only share your information in the following limited circumstances:
          </p>

          <p className="my-3"><strong className="font-semibold">With Your Borrowers</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">When you invite someone to track a loan, we share relevant loan details and your contact information with that person</li>
            <li className="my-2">Loan records and payment information are visible to both you and the borrower for that specific loan</li>
          </ul>

          <p className="my-3"><strong className="font-semibold">With Service Providers</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">We may use trusted third-party service providers to help operate our Service (e.g., hosting, email delivery, analytics)</li>
            <li className="my-2">These providers are contractually obligated to protect your information and may only use it to provide services to us</li>
          </ul>

          <p className="my-3"><strong className="font-semibold">For Legal Reasons</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">We may disclose your information if required by law, court order, or government request</li>
            <li className="my-2">We may share information to protect our rights, property, or safety, or that of our users or the public</li>
            <li className="my-2">We may share information to detect, prevent, or address fraud, security, or technical issues</li>
          </ul>

          <p className="my-3"><strong className="font-semibold">Business Transfers</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">If PayFriends is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction</li>
          </ul>

          <h3 className="text-base font-semibold mt-6 mb-3">5. What We Do NOT Do With Your Information</h3>
          <p className="my-3">We want to be clear about what we do not do:</p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2"><strong className="font-semibold">We never sell your data</strong> to advertisers, data brokers, or other third parties</li>
            <li className="my-2"><strong className="font-semibold">We do not share your loan data</strong> with credit bureaus or financial institutions</li>
            <li className="my-2"><strong className="font-semibold">We do not use your information</strong> for targeted advertising outside of our Service</li>
            <li className="my-2"><strong className="font-semibold">We do not track you</strong> across other websites or apps</li>
          </ul>

          <h3 className="text-base font-semibold mt-6 mb-3">6. Data Security</h3>
          <p className="my-3">
            We take data security seriously and implement appropriate technical and organizational measures to protect your information from unauthorized access, disclosure, alteration, or destruction.
          </p>
          <p className="my-3">Security measures include:</p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Encryption of data in transit (HTTPS/TLS)</li>
            <li className="my-2">Encryption of sensitive data at rest</li>
            <li className="my-2">Secure password hashing using industry-standard algorithms</li>
            <li className="my-2">Regular security audits and updates</li>
            <li className="my-2">Access controls and authentication requirements</li>
          </ul>
          <p className="my-3">
            However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">7. Data Retention</h3>
          <p className="my-3">
            We retain your personal information for as long as your account is active or as needed to provide you with the Service. If you delete your account, we will delete or anonymize your personal information within 90 days, unless we are required to retain it for legal or regulatory reasons.
          </p>
          <p className="my-3">
            Some information may be retained in backup systems for a limited period before being permanently deleted.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">8. Your Rights and Choices</h3>
          <p className="my-3">You have the following rights regarding your personal information:</p>

          <p className="my-3"><strong className="font-semibold">Access and Portability</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">You can access your personal information at any time through your account settings</li>
            <li className="my-2">You can request a copy of your data in a portable format by contacting us</li>
          </ul>

          <p className="my-3"><strong className="font-semibold">Correction</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">You can update your account information at any time through your profile settings</li>
            <li className="my-2">If you believe any information we hold is inaccurate, you can request corrections</li>
          </ul>

          <p className="my-3"><strong className="font-semibold">Deletion</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">You can delete your account and associated data at any time</li>
            <li className="my-2">Some information may be retained as required by law or for legitimate business purposes</li>
          </ul>

          <p className="my-3"><strong className="font-semibold">Opt-Out</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">You can opt out of non-essential email communications by adjusting your notification settings</li>
            <li className="my-2">Note that we may still send you essential service-related communications</li>
          </ul>

          <h3 className="text-base font-semibold mt-6 mb-3">9. GDPR Rights (For European Users)</h3>
          <p className="my-3">
            If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR):
          </p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2"><strong className="font-semibold">Right to Access:</strong> Request confirmation of what personal data we process and obtain a copy</li>
            <li className="my-2"><strong className="font-semibold">Right to Rectification:</strong> Request correction of inaccurate personal data</li>
            <li className="my-2"><strong className="font-semibold">Right to Erasure:</strong> Request deletion of your personal data in certain circumstances</li>
            <li className="my-2"><strong className="font-semibold">Right to Restriction:</strong> Request that we limit how we use your data</li>
            <li className="my-2"><strong className="font-semibold">Right to Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
            <li className="my-2"><strong className="font-semibold">Right to Object:</strong> Object to our processing of your personal data</li>
            <li className="my-2"><strong className="font-semibold">Right to Withdraw Consent:</strong> Withdraw consent at any time where processing is based on consent</li>
          </ul>

          <h3 className="text-base font-semibold mt-6 mb-3">10. Children&apos;s Privacy</h3>
          <p className="my-3">
            PayFriends is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child under 18, we will take steps to delete that information promptly.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">11. International Data Transfers</h3>
          <p className="my-3">
            Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. By using PayFriends, you consent to the transfer of your information to these countries.
          </p>
          <p className="my-3">
            We take steps to ensure that your data receives an adequate level of protection wherever it is processed.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">12. Cookies and Tracking</h3>
          <p className="my-3">
            We use cookies and similar tracking technologies to operate and improve our Service. For more information about the cookies we use, please see our <Link href="/legal/cookies" className="text-pf-accent no-underline hover:underline">Cookie Notice</Link>.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">13. Third-Party Links</h3>
          <p className="my-3">
            Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any information to them.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">14. Changes to This Privacy Policy</h3>
          <p className="my-3">
            We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes by posting the updated policy on this page and updating the &quot;Last updated&quot; date.
          </p>
          <p className="my-3">
            We encourage you to review this Privacy Policy periodically. Your continued use of PayFriends after changes are posted constitutes your acceptance of the updated Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
