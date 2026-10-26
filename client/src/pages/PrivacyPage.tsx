import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/ui/Brand';
import { Alert } from '@/components/ui/Alert';

export function PrivacyPage() {
  useDocumentTitle('Privacy notice');
  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="Legal · Draft"
          title="Privacy notice"
          description="How this AyosDito deployment handles personal information, written for the MVP build. This is a working draft, not legal advice."
        />

        <div className="mt-7 space-y-3">
          <Alert tone="warning" title="Draft for launch review">
            This notice must be reviewed by qualified Philippine counsel and completed with the
            operator’s identity and a working privacy contact before public launch. It is aligned with
            the Data Privacy Act of 2012 and its implementing rules in plain language, but it has not
            been certified as legally compliant.
          </Alert>
          <Alert tone="info" title="No published privacy contact in this build">
            This MVP does not ship with a real support inbox or Data Protection Officer contact. The
            organisation operating the deployed site is responsible for publishing those details and
            responding to data-subject requests.
          </Alert>
        </div>

        <article className="prose-legal mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">
            Last updated: 26 October 2026
          </p>

          <h2>1. Who is responsible for your information</h2>
          <p>
            AyosDito is a local services marketplace. The organisation operating the deployment you are
            using is the personal information controller for account and marketplace data. Depending on
            how the site is hosted and supported, third-party service providers may act as personal
            information processors on the operator’s instructions.
          </p>
          <p>
            This repository is an MVP. Before launch, the operator must replace this paragraph with its
            legal name, address, Data Protection Officer details, and a monitored privacy contact
            channel.
          </p>

          <h2>2. Information we collect</h2>
          <h3>Account and sign-in information</h3>
          <ul>
            <li>Your full name, email address, account role, and preferred service location.</li>
            <li>A bcrypt password hash. The plain-text password is never stored.</li>
            <li>Email verification state and timestamps.</li>
            <li>
              Session records containing a hashed session token and expiry time. The raw session token
              is stored in an HTTP-only cookie in your browser.
            </li>
          </ul>

          <h3>Provider information</h3>
          <ul>
            <li>
              Business or display name, description, years of experience, profile photo, service areas,
              service listings, price guides, and portfolio images.
            </li>
            <li>
              Verification requests, which in this MVP contain a written note and review outcome — not
              uploaded identity documents. Do not upload or paste identity documents into the
              verification note.
            </li>
          </ul>

          <h3>Marketplace activity</h3>
          <ul>
            <li>Service request titles, descriptions, categories, locations, and preferred schedules.</li>
            <li>Quotations, prices, quote notes, estimated durations, and request status history timestamps.</li>
            <li>Reviews, provider responses, favorites, and reports you submit.</li>
            <li>Administrator actions recorded in audit logs, including the acting account and reason where required.</li>
          </ul>

          <h3>Technical information</h3>
          <ul>
            <li>Basic request logs needed to operate and secure the service.</li>
            <li>
              Strictly necessary cookies for signing you in and protecting state-changing requests from
              cross-site forgery. This MVP does not include advertising or third-party analytics
              trackers.
            </li>
          </ul>

          <h2>3. What other people can see</h2>
          <ul>
            <li>
              A public provider profile shows the business or display name, description, service areas,
              listings, price guides, portfolio images, verification badges, and visible reviews.
            </li>
            <li>
              Public reviews show a shortened customer name (not the full name or email address), the
              rating, the comment, and any provider response.
            </li>
            <li>
              A provider who is eligible to quote can see the request description, category, location,
              preferred schedule, and a shortened customer name. Your email address is not included.
            </li>
            <li>
              Your email address becomes visible to the provider whose quote you accept, so that the
              two of you can coordinate the job. The assigned provider’s sign-in email becomes visible
              to you after acceptance for the same reason.
            </li>
            <li>
              Administrators can access account, request, quote, review, report, verification, and audit
              records to operate and moderate the marketplace.
            </li>
          </ul>

          <h2>4. Why we use the information</h2>
          <ul>
            <li>To create and secure accounts, authenticate sessions, and enforce role permissions.</li>
            <li>To publish provider profiles and service information that providers choose to list.</li>
            <li>To match requests with eligible providers and let customers compare quotations.</li>
            <li>To support the request lifecycle, reviews, moderation, reports, and audit requirements.</li>
            <li>To send verification, security, and password-reset messages when email delivery is configured.</li>
            <li>To detect abuse, prevent fraud, and maintain service reliability.</li>
            <li>To comply with legal obligations that apply to the operator.</li>
          </ul>

          <h2>5. Legal bases</h2>
          <p>
            Depending on the activity, the operator may rely on your consent, the performance of a
            contract with you, compliance with a legal obligation, or legitimate interests that are not
            overridden by your rights. Where consent is required, it must be freely given, specific, and
            evidenced. The operator should confirm its legal bases with counsel before launch.
          </p>

          <h2>6. Cookies</h2>
          <p>
            AyosDito sets a session cookie so you remain signed in, and a CSRF cookie so the site can
            prove that state-changing requests came from its own pages. These cookies are required for
            the service to work. This MVP does not set advertising cookies or use third-party behavioural
            analytics.
          </p>

          <h2>7. Sharing and processors</h2>
          <p>
            We do not sell personal information. Information may be shared with:
          </p>
          <ul>
            <li>
              The provider or customer involved in a request, limited as described in section 3.
            </li>
            <li>
              Hosting, database, file-storage, email-delivery, and monitoring providers that support the
              deployment, under appropriate processor terms.
            </li>
            <li>
              Administrators and personnel who need access to operate, moderate, or secure the service.
            </li>
            <li>
              Authorities or other parties when required by Philippine law or a valid legal process.
            </li>
          </ul>
          <p>
            The actual service providers used depend on the deployment. The operator must list them and
            assess cross-border transfer requirements before launch.
          </p>

          <h2>8. Retention</h2>
          <p>
            Sessions expire after 7 days by default. Email verification links expire after 24 hours and
            password-reset links after 30 minutes. Account and marketplace records are kept while the
            account is active and for as long afterwards as needed for legitimate business, security,
            dispute, and legal purposes. Audit logs may be retained longer for accountability.
          </p>
          <p>
            Expired tokens are invalid, but this MVP does not include an automated retention or purge
            schedule. The operator must define retention periods, delete records that are no longer
            needed, and document that process.
          </p>

          <h2>9. Security</h2>
          <p>
            Passwords are hashed with bcrypt. Session tokens are hashed before storage and sent in
            HTTP-only cookies. State-changing requests require a CSRF token, and every role-sensitive
            operation is checked on the server. Write and authentication endpoints are rate-limited.
          </p>
          <p>
            Portfolio images are intended to be public. Verification records in this MVP contain only a
            written note, not identity documents. Never upload identity documents or other sensitive
            files as portfolio images, because that area is publicly accessible. No system is perfectly
            secure; report suspected issues to the site operator.
          </p>

          <h2>10. Your rights</h2>
          <p>
            Subject to the Data Privacy Act of 2012 and its implementing rules, you may have the right to
            be informed, to object to processing, to access your personal information, to request
            correction, to request erasure or blocking, to claim damages for violations, and to lodge a
            complaint with the National Privacy Commission.
          </p>
          <p>
            This MVP does not yet include self-service account deletion or data export. The operator must
            handle verified requests manually through a documented process and assess any legal
            retention obligations before deleting records.
          </p>

          <h2>11. Children</h2>
          <p>
            AyosDito is intended for users aged 18 and above who can enter into binding agreements.
            The service is not directed to children, and the operator should not knowingly collect their
            personal information. Contact the operator if you believe a child has created an account.
          </p>

          <h2>12. Changes to this notice</h2>
          <p>
            This notice may change as the MVP develops. Material changes should be communicated through
            the account email or a prominent site notice before they take effect.
          </p>

          <h2>13. Contact and complaints</h2>
          <p>
            The operator must publish a working privacy contact and DPO details here before launch. Data
            subjects may also contact the National Privacy Commission through its official channels.
          </p>
          <p>
            For how the marketplace works, read the <Link to="/terms">terms of use</Link> and{' '}
            <Link to="/how-it-works">how AyosDito works</Link>.
          </p>
        </article>
      </div>
    </div>
  );
}
