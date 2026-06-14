import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Boy Tenggara AI',
  description: 'Terms of Service for Boy Tenggara AI platform.',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Terms of Service</h1>
        <p className="text-sm text-stone-500 mb-8">Last updated: June 14, 2026</p>

        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using <strong>Boy Tenggara AI</strong> (&ldquo;the Service&rdquo;),
            you agree to be bound by these Terms of Service. If you do not agree, do not use
            the Service.
          </p>
        </Section>

        <Section title="2. Description of Service">
          <p>
            Boy Tenggara AI provides AI-powered tools and services, including content
            generation, automation, and analytics. Features may change over time without
            prior notice.
          </p>
        </Section>

        <Section title="3. User Accounts">
          <p>
            You may sign in using Facebook Login. You are responsible for maintaining the
            confidentiality of your login credentials and for all activities under your
            account.
          </p>
          <p>
            You must provide accurate and complete information. We reserve the right to
            suspend or terminate accounts that violate these terms.
          </p>
        </Section>

        <Section title="4. Acceptable Use">
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose.</li>
            <li>Attempt to gain unauthorized access to our systems.</li>
            <li>
              Upload or generate content that is illegal, harmful, harassing, or
              infringes on others&apos; rights.
            </li>
            <li>Misuse or abuse the Service in a way that disrupts other users.</li>
          </ul>
        </Section>

        <Section title="5. Intellectual Property">
          <p>
            The Service, its underlying code, design, and branding are owned by Boy
            Tenggara. Content you generate using our AI tools remains yours, subject to
            these terms.
          </p>
        </Section>

        <Section title="6. Third-Party Services">
          <p>
            The Service may integrate with third-party platforms (e.g., Facebook). We are
            not responsible for the availability or practices of those platforms. Use of
            third-party services is subject to their own terms.
          </p>
        </Section>

        <Section title="7. Limitation of Liability">
          <p>
            The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We
            are not liable for any damages arising from your use of the Service, to the
            fullest extent permitted by law.
          </p>
        </Section>

        <Section title="8. Termination">
          <p>
            We may suspend or terminate your access to the Service at any time, with or
            without cause, without prior notice.
          </p>
        </Section>

        <Section title="9. Changes to Terms">
          <p>
            We may update these Terms of Service from time to time. Continued use of the
            Service after changes constitutes acceptance of the new terms.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            For questions about these Terms, contact us at:
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
