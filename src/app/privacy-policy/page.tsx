import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Boy Tenggara AI',
  description: 'Privacy Policy for Boy Tenggara AI services.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Privacy Policy</h1>
        <p className="text-sm text-stone-500 mb-8">Last updated: June 14, 2026</p>

        <Section title="1. Information We Collect">
          <p>
            When you log in using <strong>Facebook Login</strong>, we collect:
          </p>
          <ul>
            <li>Your Facebook user ID</li>
            <li>Your name as listed on your Facebook profile</li>
            <li>Your email address associated with your Facebook account</li>
          </ul>
          <p>
            We may also collect information you provide directly, such as messages or content
            you submit through our services.
          </p>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul>
            <li>To create and manage your account on Boy Tenggara AI.</li>
            <li>To provide, maintain, and improve our AI-powered services.</li>
            <li>To communicate with you about your account and our services.</li>
            <li>To comply with legal obligations and enforce our terms.</li>
          </ul>
        </Section>

        <Section title="3. Data Sharing and Disclosure">
          <p>We do <strong>not</strong> sell your personal data to third parties.</p>
          <p>
            We may share data with trusted service providers who help us operate our platform
            (hosting, analytics). These providers are contractually bound to protect your data.
          </p>
          <p>
            We may disclose information if required by law or to protect our rights and the
            safety of others.
          </p>
        </Section>

        <Section title="4. Data Retention">
          <p>
            We retain your personal data only as long as necessary to provide our services
            or as required by law. You can request deletion of your data at any time — see
            our{' '}
            <a href="/data-deletion" className="text-violet-700 underline">
              Data Deletion
            </a>{' '}
            page for instructions.
          </p>
        </Section>

        <Section title="5. Your Rights">
          <p>
            Depending on your location, you may have the right to:
          </p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction or deletion of your data.</li>
            <li>Withdraw consent for data processing.</li>
            <li>Lodge a complaint with a supervisory authority.</li>
          </ul>
          <p>
            To exercise these rights, contact us at{' '}
            <strong>boy.tenggara@gmail.com</strong>.
          </p>
        </Section>

        <Section title="6. Security">
          <p>
            We implement reasonable security measures to protect your personal data.
            However, no method of transmission over the internet is 100% secure.
          </p>
        </Section>

        <Section title="7. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on
            this page with an updated date.
          </p>
        </Section>

        <Section title="8. Contact">
          <p>
            If you have questions about this Privacy Policy, contact us at:
          </p>
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mt-2 text-center">
            <code className="text-base font-semibold text-violet-700">
              boy.tenggara@gmail.com
            </code>
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-stone-900 mb-2">{title}</h2>
      <div className="text-sm text-stone-600 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  )
}
