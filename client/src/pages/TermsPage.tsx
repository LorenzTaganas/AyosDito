import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/ui/Brand';
import { Alert } from '@/components/ui/Alert';

export function TermsPage() {
  useDocumentTitle('Terms of use');
  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="Legal · Draft"
          title="Terms of use"
          description="The rules for using this AyosDito MVP deployment. This is a working draft that must be reviewed before launch."
        />

        <div className="mt-7">
          <Alert tone="warning" title="Draft, not a launched commercial service">
            AyosDito is currently an MVP build. These terms have not been reviewed by Philippine
            counsel, and the operator’s legal name, address, dispute venue, and contact channel must be
            added before launch. Do not rely on this draft as legal advice.
          </Alert>
        </div>

        <article className="prose-legal mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">
            Last updated: 26 October 2026
          </p>

          <h2>1. Accepting these terms</h2>
          <p>
            By creating an account or using AyosDito, you agree to these terms and the{' '}
            <Link to="/privacy">privacy notice</Link>. If you do not agree, do not use the service. You
            must be at least 18 years old and legally able to enter into agreements in the Philippines.
          </p>

          <h2>2. What AyosDito is</h2>
          <p>
            AyosDito is a marketplace that helps customers describe local service needs, receive
            quotations from providers, and track a job lifecycle. AyosDito is not a party to the
            agreement between a customer and a provider, is not an employer or agent of either side, and
            does not supervise the work.
          </p>
          <p>
            This MVP does not process payments, hold deposits in escrow, issue refunds, provide
            insurance, or guarantee workmanship, timeliness, or outcomes. Any payment arrangement is
            made directly between the customer and the provider at their own risk.
          </p>

          <h2>3. Accounts and security</h2>
          <ul>
            <li>Provide accurate information and keep it up to date.</li>
            <li>Keep your password confidential and do not share your account.</li>
            <li>Notify the operator promptly if you suspect unauthorised access.</li>
            <li>
              Do not create accounts to evade a suspension, impersonate someone else, scrape the
              marketplace, or interfere with other users.
            </li>
            <li>
              One person may hold separate customer and provider accounts, but each account must use its
              own accurate identity and must not be used to manufacture reviews or quotes.
            </li>
          </ul>

          <h2>4. Customers</h2>
          <ul>
            <li>Describe jobs honestly and lawfully, and do not request illegal or unsafe work.</li>
            <li>
              Do not include identity numbers, financial details, or another person’s private
              information in request text or reviews.
            </li>
            <li>
              Compare quotes and ask questions before accepting. A provider’s badge or rating is
              information, not a guarantee.
            </li>
            <li>
              Review only after a completed job. Reviews must reflect your own experience and must not
              be used to extort, threaten, or harass.
            </li>
          </ul>

          <h2>5. Providers</h2>
          <ul>
            <li>
              Provide accurate business, service, price, experience, and service-area information, and
              update it when it changes.
            </li>
            <li>
              Only offer work you are qualified and lawfully permitted to perform. You are responsible
              for any licences, permits, taxes, and insurance required for your work.
            </li>
            <li>
              Price guides are estimates unless clearly marked as fixed. Explain parts, exclusions, and
              any inspection requirements in your quote.
            </li>
            <li>
              Do not claim verification, credentials, reviews, jobs, or affiliations you do not have.
              Verification badges are granted only after an administrator reviews a request and can be
              removed if the basis is no longer valid.
            </li>
            <li>
              Do not ask customers to move communication or payment outside the marketplace to evade
              moderation, fees, or safety checks.
            </li>
          </ul>

          <h2>6. Quotes, acceptance, and statuses</h2>
          <p>
            A quote is an offer from a provider, not a guaranteed final charge. A provider may update a
            pending quote while the request is open. When a customer accepts one quote, the other pending
            quotes for that request are declined and the job is assigned to the accepted provider.
          </p>
          <p>
            Statuses shown in AyosDito reflect actions recorded by the parties. The application does not
            independently confirm that work happened, that a price was fair, or that a completion claim
            is accurate.
          </p>

          <h2>7. Reviews, reports, and moderation</h2>
          <ul>
            <li>Reviews are limited to one per completed request and must come from the request’s customer.</li>
            <li>Self-reviews, review swaps, purchased reviews, and coordinated fake feedback are prohibited.</li>
            <li>
              Providers may write one response to a visible review. Responses must be civil and must not
              reveal private customer information.
            </li>
            <li>
              Administrators may hide content or restrict accounts that violate these terms. Reports do
              not automatically remove content and are reviewed with context.
            </li>
            <li>
              Repeated or knowingly false reports, abuse, spam, discrimination, threats, and fraudulent
              activity may lead to suspension or termination.
            </li>
          </ul>

          <h2>8. Verification</h2>
          <p>
            Verification is optional and separate from account registration and provider approval. A
            badge means an administrator reviewed the evidence supplied at that time. It does not mean
            AyosDito endorses the provider, guarantees future work, or continuously monitors the
            provider’s conduct.
          </p>
          <p>
            Do not submit identity documents through portfolio uploads or public fields. This MVP’s
            verification flow records a written note only; the operator must run any evidence-collection
            step through a private, access-controlled process.
          </p>

          <h2>9. Your content</h2>
          <p>
            You keep ownership of content you submit, such as descriptions, portfolio images, quotes,
            and reviews. You grant the operator a non-exclusive licence to host, display, moderate, and
            process that content as needed to run the marketplace. You must have the rights necessary to
            upload every image you submit.
          </p>

          <h2>10. Prohibited conduct</h2>
          <ul>
            <li>Fraud, scams, impersonation, harassment, threats, hate, or discriminatory treatment.</li>
            <li>Illegal services, dangerous work, or instructions that could harm a person or property.</li>
            <li>Attempts to bypass access controls, probe vulnerabilities without authorisation, or disrupt the service.</li>
            <li>Scraping, bulk messaging, malware, or automated abuse.</li>
            <li>Uploading content that infringes intellectual property, privacy, or other rights.</li>
          </ul>

          <h2>11. Suspension and termination</h2>
          <p>
            The operator may suspend or terminate access to protect users, investigate reports, comply
            with law, or enforce these terms. Providers may be removed from the public directory when
            their approval is revoked. The operator should document moderation actions and provide a
            reasonable way to ask questions, consistent with the privacy notice.
          </p>

          <h2>12. Disclaimers and limitation of liability</h2>
          <p>
            The service is provided on an “as is” and “as available” basis to the extent permitted by
            Philippine law. The operator does not warrant uninterrupted service, the accuracy of
            provider-supplied information, or the quality of any job. To the maximum extent permitted by
            law, the operator is not liable for indirect, incidental, or consequential losses arising
            from dealings between customers and providers.
          </p>
          <p>
            Nothing in these terms excludes rights or liabilities that cannot lawfully be excluded,
            including consumer protections that apply.
          </p>

          <h2>13. Privacy</h2>
          <p>
            Personal information is handled as described in the <Link to="/privacy">privacy notice</Link>.
            That notice explains what is public, when contact details are shared, and how to exercise
            data-subject rights.
          </p>

          <h2>14. Changes and governing law</h2>
          <p>
            These terms may change as the MVP develops. Material changes should be communicated before
            they take effect. These terms are governed by the laws of the Republic of the Philippines.
            The operator must add a specific dispute-resolution process and venue before launch.
          </p>

          <h2>15. Contact</h2>
          <p>
            A working support and legal contact must be published by the operator before public launch.
            This build does not include one. For product behaviour, read{' '}
            <Link to="/how-it-works">how AyosDito works</Link>.
          </p>
        </article>
      </div>
    </div>
  );
}
