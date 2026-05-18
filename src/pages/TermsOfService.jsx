import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Film } from 'lucide-react'

const LAST_UPDATED = 'May 18, 2026'

export default function TermsOfService() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg font-body">
      <header className="fixed top-0 left-0 right-0 z-20 border-b border-accent-secondary/15 backdrop-blur-sm"
        style={{ background: 'rgb(var(--color-bg) / 0.85)' }}>
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-surface transition-colors text-text-secondary">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Film size={18} className="text-accent" />
            <span className="font-heading font-bold text-text">ReelAlert</span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 pt-24 pb-16">
        <h1 className="font-heading font-bold text-text text-3xl mb-2">Terms of Service</h1>
        <p className="text-text-secondary text-sm font-body mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-text-secondary font-body text-sm leading-relaxed">

          <Section title="1. Acceptance of Terms">
            By creating an account or using ReelAlert ("the Service"), you agree to be bound by these
            Terms of Service. If you do not agree, do not use the Service.
          </Section>

          <Section title="2. Description of Service">
            ReelAlert is a personalized movie recommendation service that ranks films currently in
            theaters based on your taste preferences and delivers curated digests via SMS. The Service
            is provided for personal, non-commercial use only.
          </Section>

          <Section title="3. Accounts">
            <p>You must provide a valid email address to create an account. You are responsible for
            maintaining the confidentiality of your account credentials and for all activity that
            occurs under your account.</p>
            <p className="mt-3">You must be at least 13 years old to use the Service. By using the Service,
            you represent that you meet this requirement.</p>
          </Section>

          <Section title="4. SMS Communications">
            <p>By providing your phone number and enabling SMS digests, you consent to receive text
            messages from ReelAlert. Message and data rates may apply depending on your carrier.</p>
            <p className="mt-3">You can opt out of SMS messages at any time by replying STOP to any message
            or by disabling SMS digests in your account settings. After opting out, you may receive
            one final confirmation message.</p>
            <p className="mt-3">ReelAlert uses Twilio to deliver SMS messages. By using the SMS feature,
            you also agree to Twilio's messaging policies.</p>
          </Section>

          <Section title="5. Acceptable Use">
            You agree not to:
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Create multiple accounts to circumvent restrictions</li>
              <li>Scrape, crawl, or otherwise extract data from the Service in bulk</li>
            </ul>
          </Section>

          <Section title="6. Third-Party Services">
            ReelAlert displays data from third-party sources including The Movie Database (TMDB),
            OMDb, Rotten Tomatoes, and Letterboxd. This data is provided for informational purposes.
            We make no guarantees about its accuracy or completeness. Your use of content from these
            sources is subject to their respective terms of service.
          </Section>

          <Section title="7. Disclaimer of Warranties">
            The Service is provided "as is" and "as available" without warranties of any kind, either
            express or implied. ReelAlert does not warrant that the Service will be uninterrupted,
            error-free, or that movie data will always be accurate or current.
          </Section>

          <Section title="8. Limitation of Liability">
            To the fullest extent permitted by law, ReelAlert shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising from your use of or
            inability to use the Service.
          </Section>

          <Section title="9. Changes to Terms">
            We may update these Terms from time to time. We will notify you of material changes by
            updating the "Last updated" date at the top of this page. Continued use of the Service
            after changes constitutes acceptance of the updated Terms.
          </Section>

          <Section title="10. Contact">
            Questions about these Terms? Contact us at{' '}
            <a href="mailto:support@reelalert.app" className="text-accent hover:underline">
              support@reelalert.app
            </a>.
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="font-heading font-semibold text-text text-base mb-3">{title}</h2>
      <div className="text-text-secondary">{children}</div>
    </div>
  )
}
