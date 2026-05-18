import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Film } from 'lucide-react'

const LAST_UPDATED = 'May 18, 2026'

export default function PrivacyPolicy() {
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
        <h1 className="font-heading font-bold text-text text-3xl mb-2">Privacy Policy</h1>
        <p className="text-text-secondary text-sm font-body mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-text-secondary font-body text-sm leading-relaxed">

          <Section title="1. Information We Collect">
            <p className="font-medium text-text mb-2">Information you provide directly:</p>
            <ul className="list-disc ml-5 space-y-1 mb-4">
              <li>Email address (required for account creation)</li>
              <li>Phone number (optional, required for SMS digests)</li>
              <li>ZIP code (used to find nearby theaters)</li>
              <li>Genre and people preferences you set in the app</li>
              <li>Scoring weight preferences</li>
            </ul>
            <p className="font-medium text-text mb-2">Information collected automatically:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>Log data such as pages visited and features used</li>
              <li>Device type and browser (for compatibility purposes)</li>
              <li>SMS delivery status from our messaging provider</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc ml-5 space-y-2">
              <li>To compute your personalized ReelScore rankings for movies in theaters</li>
              <li>To send SMS digests to your phone number on your selected schedule</li>
              <li>To find theater showtimes near your ZIP code</li>
              <li>To save and sync your preferences across sessions</li>
              <li>To improve the Service and diagnose technical issues</li>
            </ul>
            <p className="mt-3">We do not sell your personal information to third parties. We do not use
            your data to serve advertising.</p>
          </Section>

          <Section title="3. SMS and Phone Number Data">
            <p>Your phone number is used solely to deliver the SMS digests you request. It is stored
            securely in our database and transmitted to Twilio (our SMS provider) only for the
            purpose of sending messages.</p>
            <p className="mt-3">You can delete your phone number at any time from Settings. Removing your
            number will stop all future SMS messages. You can also reply STOP to any message to
            opt out immediately.</p>
          </Section>

          <Section title="4. Data Storage and Security">
            <p>Your account data is stored on Supabase, a managed cloud database platform with
            encryption at rest and in transit. We use Supabase's built-in authentication, which
            follows industry-standard security practices including bcrypt password hashing.</p>
            <p className="mt-3">While we take reasonable measures to protect your information, no method of
            transmission over the internet is 100% secure. We cannot guarantee absolute security.</p>
          </Section>

          <Section title="5. Third-Party Services">
            ReelAlert integrates with the following third-party services:
            <ul className="list-disc ml-5 mt-2 space-y-2">
              <li><span className="text-text font-medium">Twilio</span> — delivers SMS messages. Your phone number is shared with Twilio only to send messages you requested.</li>
              <li><span className="text-text font-medium">The Movie Database (TMDB)</span> — provides movie metadata, cast, and poster images. No personal data is shared.</li>
              <li><span className="text-text font-medium">OMDb</span> — provides IMDb and Rotten Tomatoes ratings. No personal data is shared.</li>
              <li><span className="text-text font-medium">Letterboxd</span> — rating data is fetched server-side. No personal data is shared.</li>
              <li><span className="text-text font-medium">Vercel</span> — hosts the application. Subject to Vercel's privacy policy.</li>
            </ul>
          </Section>

          <Section title="6. Your Rights and Choices">
            <ul className="list-disc ml-5 space-y-2">
              <li><span className="text-text font-medium">Access:</span> You can view and update your preferences at any time in Settings.</li>
              <li><span className="text-text font-medium">Deletion:</span> You can delete your account by contacting us. We will remove your personal data within 30 days.</li>
              <li><span className="text-text font-medium">SMS opt-out:</span> Reply STOP to any text, or disable SMS in Settings.</li>
              <li><span className="text-text font-medium">Data portability:</span> Contact us to request an export of your data.</li>
            </ul>
          </Section>

          <Section title="7. Children's Privacy">
            The Service is not directed at children under 13. We do not knowingly collect personal
            information from children under 13. If you believe we have inadvertently collected such
            information, please contact us immediately.
          </Section>

          <Section title="8. Changes to This Policy">
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by updating the "Last updated" date at the top of this page. We encourage you
            to review this policy periodically.
          </Section>

          <Section title="9. Contact Us">
            For privacy-related questions, requests, or concerns, contact us at{' '}
            <a href="mailto:privacy@reelalert.app" className="text-accent hover:underline">
              privacy@reelalert.app
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
