import Link from 'next/link';

export default function CookiesPage() {
  return (
    <div>
      <Link href="/legal" className="inline-block mb-4 text-sm text-pf-accent no-underline hover:underline">
        ← Back to Legal Information
      </Link>

      <h1 className="text-[28px] font-semibold m-0 mb-2">Cookie Notice</h1>
      <p className="text-pf-muted text-[13px] italic mb-4">Last updated: January 2025</p>

      <div className="bg-pf-card border border-pf-card-border rounded-2xl p-6">
        <div className="text-sm leading-[1.7] text-pf-text">
          <h3 className="text-base font-semibold mt-6 mb-3 first:mt-0">1. What Are Cookies?</h3>
          <p className="my-3">
            Cookies are small text files that are placed on your device when you visit a website. They help websites remember information about your visit, such as your preferences and login status, making your experience more efficient and personalized.
          </p>
          <p className="my-3">
            Cookies do not contain viruses or malware and cannot access or read other files on your device. They can only be read by the website that created them.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">2. How PayFriends Uses Cookies</h3>
          <p className="my-3">
            PayFriends uses cookies to provide essential functionality and improve your experience. We believe in minimal, privacy-respecting tracking, so we only use cookies that are necessary for the Service to function properly.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">3. Types of Cookies We Use</h3>

          <p className="my-3"><strong className="font-semibold">Strictly Necessary Cookies</strong></p>
          <p className="my-3">
            These cookies are essential for the operation of PayFriends. Without these cookies, the Service would not function properly. These cookies include:
          </p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2"><strong className="font-semibold">Authentication cookies:</strong> Keep you logged in as you navigate between pages</li>
            <li className="my-2"><strong className="font-semibold">Session cookies:</strong> Maintain your session state and temporary data</li>
            <li className="my-2"><strong className="font-semibold">Security cookies:</strong> Help protect your account from unauthorized access</li>
          </ul>
          <p className="my-3">
            Because these cookies are essential for the Service, they cannot be disabled if you want to use PayFriends.
          </p>

          <p className="my-3"><strong className="font-semibold">Functional Cookies</strong></p>
          <p className="my-3">
            These cookies remember your preferences and choices to provide a more personalized experience. For example:
          </p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">Language preferences</li>
            <li className="my-2">Display settings and layout choices</li>
            <li className="my-2">Notification preferences</li>
          </ul>

          <h3 className="text-base font-semibold mt-6 mb-3">4. What We Do NOT Use</h3>
          <p className="my-3">We want to be transparent about what we do not do:</p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2"><strong className="font-semibold">No advertising cookies:</strong> We do not use cookies for advertising or marketing purposes</li>
            <li className="my-2"><strong className="font-semibold">No third-party tracking:</strong> We do not allow third-party advertisers or data brokers to place cookies on our site</li>
            <li className="my-2"><strong className="font-semibold">No cross-site tracking:</strong> We do not track your activity across other websites</li>
            <li className="my-2"><strong className="font-semibold">No social media tracking:</strong> We do not use social media tracking pixels or similar technologies</li>
          </ul>

          <h3 className="text-base font-semibold mt-6 mb-3">5. Cookie Details</h3>
          <p className="my-3">Below is a summary of the cookies we use:</p>

          <div className="my-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-white/10 p-3 text-left bg-white/5 font-semibold">Cookie Name</th>
                  <th className="border border-white/10 p-3 text-left bg-white/5 font-semibold">Purpose</th>
                  <th className="border border-white/10 p-3 text-left bg-white/5 font-semibold">Type</th>
                  <th className="border border-white/10 p-3 text-left bg-white/5 font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-white/10 p-3">session_token</td>
                  <td className="border border-white/10 p-3">Authenticates your login session</td>
                  <td className="border border-white/10 p-3">Essential</td>
                  <td className="border border-white/10 p-3">30 days or until logout</td>
                </tr>
                <tr>
                  <td className="border border-white/10 p-3">csrf_token</td>
                  <td className="border border-white/10 p-3">Protects against cross-site request forgery attacks</td>
                  <td className="border border-white/10 p-3">Security</td>
                  <td className="border border-white/10 p-3">Session (deleted when browser closes)</td>
                </tr>
                <tr>
                  <td className="border border-white/10 p-3">user_prefs</td>
                  <td className="border border-white/10 p-3">Stores your display and notification preferences</td>
                  <td className="border border-white/10 p-3">Functional</td>
                  <td className="border border-white/10 p-3">1 year</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-base font-semibold mt-6 mb-3">6. How to Control Cookies</h3>
          <p className="my-3">You have several options for managing cookies:</p>

          <p className="my-3"><strong className="font-semibold">Browser Settings</strong></p>
          <p className="my-3">
            Most web browsers allow you to control cookies through their settings. You can typically:
          </p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2">View what cookies are stored and delete them individually</li>
            <li className="my-2">Block third-party cookies</li>
            <li className="my-2">Block all cookies from specific websites</li>
            <li className="my-2">Delete all cookies when you close your browser</li>
            <li className="my-2">Block all cookies (note: this will prevent you from using PayFriends)</li>
          </ul>

          <p className="my-3"><strong className="font-semibold">How to Access Cookie Settings in Popular Browsers:</strong></p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2"><strong className="font-semibold">Google Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
            <li className="my-2"><strong className="font-semibold">Mozilla Firefox:</strong> Settings → Privacy &amp; Security → Cookies and Site Data</li>
            <li className="my-2"><strong className="font-semibold">Safari:</strong> Preferences → Privacy → Cookies and website data</li>
            <li className="my-2"><strong className="font-semibold">Microsoft Edge:</strong> Settings → Cookies and site permissions → Cookies and site data</li>
          </ul>

          <p className="my-3"><strong className="font-semibold">Important Note</strong></p>
          <p className="my-3">
            If you block or delete cookies, some features of PayFriends may not work properly. In particular, you will not be able to stay logged in or use essential features of the Service.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">7. Do Not Track</h3>
          <p className="my-3">
            Some browsers include a &quot;Do Not Track&quot; (DNT) feature that signals to websites that you do not want to be tracked. Because we do not use tracking or advertising cookies, enabling DNT will not change how PayFriends operates.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">8. Local Storage and Similar Technologies</h3>
          <p className="my-3">In addition to cookies, PayFriends may use similar technologies such as:</p>
          <ul className="my-3 pl-6 list-disc">
            <li className="my-2"><strong className="font-semibold">Local Storage:</strong> Used to store larger amounts of data locally on your device for faster performance</li>
            <li className="my-2"><strong className="font-semibold">Session Storage:</strong> Temporary storage that is cleared when you close your browser tab</li>
          </ul>
          <p className="my-3">
            These technologies serve similar purposes to cookies and are subject to the same privacy protections described in our <Link href="/legal/privacy" className="text-pf-accent no-underline hover:underline">Privacy Policy</Link>.
          </p>

          <h3 className="text-base font-semibold mt-6 mb-3">9. Updates to This Cookie Notice</h3>
          <p className="my-3">
            We may update this Cookie Notice from time to time to reflect changes in our use of cookies or legal requirements. We will post any updates on this page with a revised &quot;Last updated&quot; date.
          </p>
          <p className="my-3">
            We encourage you to review this Cookie Notice periodically to stay informed about how we use cookies.
          </p>
        </div>
      </div>
    </div>
  );
}
