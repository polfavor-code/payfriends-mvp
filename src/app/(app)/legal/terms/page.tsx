import Link from 'next/link';

export default function TermsPage() {
  return (
    <div>
      <Link href="/legal" className="inline-block mb-4 text-sm text-pf-accent no-underline hover:underline">
        ← Back to Legal Information
      </Link>

      <h1 className="text-[28px] font-semibold m-0 mb-2">Terms of Service</h1>
      <p className="text-pf-muted text-[13px] italic mb-4">Last updated: January 2025</p>

      <div className="bg-pf-card border border-pf-card-border rounded-2xl p-6">
        <div className="text-sm leading-[1.7] text-pf-text">
          <h3 className="text-base font-semibold mt-6 mb-3 first:mt-0">1. Introduction</h3>
          <p className="my-3">
            Welcome to PayFriends. By accessing or using the PayFriends platform (the &quot;Service&quot;), you agree to be bound by these Terms of Service (these &quot;Terms&quot;). If you do not agree to these Terms, you may not use the Service.
          </p>
          <p className="my-3">
            PayFriends is owned and operated by PayFriends (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). These Terms constitute a legally binding agreement between you and PayFriends.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">2. What PayFriends Does</h3>
          <p className="my-3">PayFriends is a personal loan tracking and record-keeping tool. Specifically, PayFriends:</p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Allows you to record details of loans you have made to friends or family</li>
            <li className="my-2">Helps you track loan balances, payments, and repayment schedules</li>
            <li className="my-2">Provides a simple interface to manage and communicate about existing loans</li>
            <li className="my-2">Stores and displays your loan records for your personal reference</li>
          </ul>

          <h3 className="text-base font-semibold mt-6 mb-3">3. What PayFriends Does NOT Do</h3>
          <p className="my-3">PayFriends is not a financial institution, lender, or payment processor. We explicitly do NOT:</p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Provide loans, credit, or any form of financing</li>
            <li className="my-2">Facilitate money transfers or payments of any kind</li>
            <li className="my-2">Collect, hold, or transmit money on your behalf</li>
            <li className="my-2">Report to credit bureaus or affect credit scores</li>
            <li className="my-2">Create legally binding loan contracts (though we may help you document existing agreements)</li>
            <li className="my-2">Provide financial, legal, or tax advice</li>
            <li className="my-2">Guarantee loan repayment or offer collection services</li>
            <li className="my-2">Act as an intermediary in your loan transactions</li>
          </ul>
          <p className="my-3">
            All loans tracked through PayFriends are arranged, funded, and repaid entirely outside of our platform. PayFriends is simply a tool to help you remember and organize information about loans that you have already made independently.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">4. Eligibility</h3>
          <p className="my-3">You must be at least 18 years old to use PayFriends. By using the Service, you represent and warrant that:</p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">You are at least 18 years of age</li>
            <li className="my-2">You have the legal capacity to enter into these Terms</li>
            <li className="my-2">All information you provide to us is accurate and truthful</li>
            <li className="my-2">You will comply with all applicable laws when using the Service</li>
          </ul>

          <h3 className="text-base font-semibold mt-6 mb-3">5. User Responsibilities</h3>
          <p className="my-3">When using PayFriends, you agree to:</p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Keep your account credentials secure and confidential</li>
            <li className="my-2">Ensure all loan information you enter is accurate to the best of your knowledge</li>
            <li className="my-2">Use the Service only for lawful purposes</li>
            <li className="my-2">Not use the Service to track illegal transactions or activities</li>
            <li className="my-2">Not attempt to access other users&apos; accounts or data</li>
            <li className="my-2">Not reverse engineer, copy, or misuse our software or technology</li>
            <li className="my-2">Comply with all applicable laws regarding loans, lending, and record-keeping in your jurisdiction</li>
          </ul>
          <p className="my-3">
            You are solely responsible for the loans you make and track using PayFriends. We have no involvement in your lending decisions or loan terms.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">6. No Financial Advice</h3>
          <p className="my-3">
            PayFriends does not provide financial, legal, or tax advice. Any information, tools, or features provided through the Service are for informational purposes only. You should consult with qualified professionals before making any financial or legal decisions.
          </p>
          <p className="my-3">
            We do not endorse or recommend any particular loan terms, interest rates, or lending practices. All lending decisions and terms are entirely your responsibility.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">7. Privacy</h3>
          <p className="my-3">
            Your privacy is important to us. Our <Link href="/legal/privacy" className="text-pf-accent no-underline hover:underline">Privacy Policy</Link> explains how we collect, use, and protect your personal information. By using PayFriends, you also agree to our Privacy Policy.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">8. Prohibited Use</h3>
          <p className="my-3">You may not use PayFriends to:</p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Track illegal loans or transactions</li>
            <li className="my-2">Violate any laws or regulations, including lending and usury laws</li>
            <li className="my-2">Engage in fraud, money laundering, or other illegal activities</li>
            <li className="my-2">Harass, abuse, or harm other users</li>
            <li className="my-2">Upload malware, viruses, or malicious code</li>
            <li className="my-2">Attempt to gain unauthorized access to our systems or other users&apos; accounts</li>
            <li className="my-2">Use automated tools or bots to access or use the Service</li>
          </ul>
          <p className="my-3">
            We reserve the right to suspend or terminate your account if we believe you are violating these Terms or engaging in prohibited activities.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">9. Reliability of the Service</h3>
          <p className="my-3">
            While we strive to make PayFriends reliable and available, we provide the Service on an &quot;as is&quot; and &quot;as available&quot; basis. We do not guarantee that the Service will always be available, error-free, or secure.
          </p>
          <p className="my-3">
            You are responsible for maintaining your own backup records of important loan information. We are not liable for any data loss, service interruptions, or technical errors.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">10. Liability</h3>
          <p className="my-3">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, PAYFRIENDS AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
          </p>
          <p className="my-3">
            IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU EXCEED THE AMOUNT YOU HAVE PAID TO US IN THE TWELVE (12) MONTHS PRIOR TO THE EVENT GIVING RISE TO THE CLAIM.
          </p>
          <p className="my-3">You acknowledge that PayFriends is not responsible for:</p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Whether your borrowers repay their loans</li>
            <li className="my-2">Disputes between you and your borrowers</li>
            <li className="my-2">The legal enforceability of your loans</li>
            <li className="my-2">Tax implications of your lending activities</li>
            <li className="my-2">Compliance with local lending or usury laws</li>
          </ul>

          <h3 className="text-base font-semibold mt-6 mb-3">11. Modification of Terms</h3>
          <p className="my-3">
            We may update these Terms from time to time. We will notify you of material changes by posting a notice on our platform or sending you an email. Your continued use of PayFriends after such changes constitutes your acceptance of the updated Terms.
          </p>
          <p className="my-3">
            If you do not agree with the updated Terms, you should stop using the Service and may request deletion of your account.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">12. Termination</h3>
          <p className="my-3">
            You may stop using PayFriends at any time and request deletion of your account.
          </p>
          <p className="my-3">
            We may suspend or terminate your access to the Service at any time, with or without notice, if we believe you have violated these Terms or for any other reason at our sole discretion.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">13. Governing Law and Disputes</h3>
          <p className="my-3">
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which PayFriends operates, without regard to its conflict of law provisions.
          </p>
          <p className="my-3">
            Any disputes arising from these Terms or your use of the Service shall be resolved through good faith negotiation. If negotiation fails, disputes may be resolved through binding arbitration or in the courts of competent jurisdiction.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">14. Severability</h3>
          <p className="my-3">
            If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">15. Entire Agreement</h3>
          <p className="my-3">
            These Terms, together with our Privacy Policy and Cookie Notice, constitute the entire agreement between you and PayFriends regarding the use of the Service.
          </p>
        </div>
      </div>
    </div>
  );
}
