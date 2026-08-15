import React from 'react';
import type { Metadata } from 'next';
import {
  Bullets,
  ContactCard,
  LegalPage,
  P,
  Section,
  Subheading,
  SupportEmail,
} from '@/features/storefront/components/legal';

// Static legal copy — no database hit, no revalidation window to reason about.
// Edits ship with a deploy, which is also when the date below should change.
export const dynamic = 'force-static';

const LAST_UPDATED = 'August 15, 2026';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Vero Goods collects, uses, shares, and protects your personal information, and the rights you have over it.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          Vero Goods (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) respects your privacy
          and is committed to protecting the personal information you provide when using our
          website. This Privacy Policy explains what information we collect, how we use it, how we
          protect it, and your rights regarding your information.
        </>
      }
      acknowledgement="By using the Vero Goods website, you acknowledge that you have read and understood this Privacy Policy."
    >
      <Section n={1} title="Information We Collect">
        <P>When you use our website or place an order, we may collect the following information:</P>

        <Subheading>Personal information</Subheading>
        <Bullets
          items={[
            'Full name',
            'Email address',
            'Phone number',
            'Billing address',
            'Shipping/delivery address',
            'Order details',
            'Payment-related information required to process your order',
          ]}
        />

        <Subheading>Technical information</Subheading>
        <P>
          When you visit our website, certain technical information may be automatically collected,
          including:
        </P>
        <Bullets
          items={[
            'IP address',
            'Browser type and version',
            'Device type',
            'Operating system',
            'Pages visited',
            'Website usage information',
            'Date and time of visits',
            'Referring website or source',
          ]}
        />
      </Section>

      <Section n={2} title="How We Use Your Information">
        <P>We may use the information collected to:</P>
        <Bullets
          items={[
            'Process and fulfill your orders.',
            'Deliver products to you.',
            'Communicate with you regarding your orders.',
            'Respond to customer support requests.',
            'Process replacement or other eligible requests.',
            'Send important order and service-related communications.',
            'Improve our website, products, and services.',
            'Detect and prevent fraudulent or unauthorized transactions.',
            'Maintain the security and functionality of our website.',
            'Comply with applicable laws and legal requirements.',
          ]}
        />
        <P>
          We will not use your personal information for purposes unrelated to the operation of our
          business without appropriate notice or consent where required by applicable law.
        </P>
      </Section>

      <Section n={3} title="Payment Information">
        <P>Payments may be processed through third-party payment service providers.</P>
        <P>
          Vero Goods does not intentionally store complete debit card, credit card, UPI, or other
          sensitive payment credentials on its own servers unless specifically stated otherwise.
        </P>
        <P>
          Payment information may be collected and processed directly by the relevant payment
          provider according to its own privacy policy and security practices.
        </P>
      </Section>

      <Section n={4} title="Sharing of Information">
        <P>
          We may share necessary information with trusted third parties when required to operate our
          business, including:
        </P>
        <Bullets
          items={[
            'Delivery and courier partners',
            'Payment service providers',
            'Website hosting and technology providers',
            'Customer support or service providers',
            'Analytics and security service providers',
            'Government authorities or law-enforcement agencies where required by law',
          ]}
        />
        <P>
          We only intend to share information that is reasonably necessary for the relevant purpose.
        </P>
        <P className="font-semibold text-ink">
          We do not sell your personal information to third parties.
        </P>
      </Section>

      <Section n={5} title="Cookies and Similar Technologies">
        <P>
          Vero Goods may use cookies and similar technologies to improve website functionality and
          user experience.
        </P>
        <P>Cookies may be used to:</P>
        <Bullets
          items={[
            'Keep the website functioning properly.',
            'Remember preferences.',
            'Understand how visitors use the website.',
            'Improve website performance.',
            'Help maintain website security.',
            'Support relevant advertising or analytics, where applicable.',
          ]}
        />
        <P>
          You may be able to control or disable cookies through your browser settings. Disabling
          certain cookies may affect some website functionality.
        </P>
      </Section>

      <Section n={6} title="Data Security">
        <P>
          We take reasonable technical and organizational measures to protect your personal
          information against unauthorized access, alteration, disclosure, misuse, or destruction.
        </P>
        <P>
          However, no method of transmitting or storing information electronically can be guaranteed
          to be completely secure. Therefore, while we take reasonable precautions, we cannot
          guarantee absolute security of your information.
        </P>
      </Section>

      <Section n={7} title="Data Retention">
        <P>We retain personal information only for as long as reasonably necessary to:</P>
        <Bullets
          items={[
            'Complete transactions and provide our services.',
            'Maintain business and transaction records.',
            'Resolve disputes and customer-service issues.',
            'Prevent fraud and misuse.',
            'Meet legal, regulatory, accounting, or reporting requirements.',
          ]}
        />
        <P>
          When information is no longer required, we may securely delete or anonymize it, subject to
          applicable legal requirements.
        </P>
      </Section>

      <Section n={8} title="Third-Party Services and Links">
        <P>
          Our website may use or link to third-party services, websites, payment providers, delivery
          providers, analytics services, or other external platforms.
        </P>
        <P>
          These third parties may have their own privacy policies and terms. Vero Goods is not
          responsible for the privacy practices, security, or content of third-party websites or
          services.
        </P>
        <P>
          We recommend reviewing the privacy policies of third-party services before providing them
          with personal information.
        </P>
      </Section>

      <Section n={9} title="Children's Privacy">
        <P>
          Our website is not intended to knowingly collect personal information directly from
          children without appropriate authorization.
        </P>
        <P>
          If we become aware that we have unintentionally collected personal information from a
          child where such collection is not permitted, we will take reasonable steps to delete the
          information.
        </P>
      </Section>

      <Section n={10} title="Your Rights">
        <P>
          Depending on applicable law, you may have rights regarding your personal information,
          including the right to:
        </P>
        <Bullets
          items={[
            'Request access to personal information we hold about you.',
            'Request correction of inaccurate information.',
            'Request deletion of information where legally permitted.',
            'Request information about how your data is being used.',
            'Withdraw consent where processing is based on consent.',
            'Raise a concern or complaint regarding the handling of your personal information.',
          ]}
        />
        <P>
          To exercise an applicable privacy right, contact us using the details provided below. We
          may need to verify your identity before processing certain requests.
        </P>
      </Section>

      <Section n={11} title="Marketing Communications">
        <P>
          If we send promotional or marketing communications, you may choose to opt out of such
          communications where applicable.
        </P>
        <P>
          You may also contact us at <SupportEmail className="font-semibold text-ink" /> to request
          that we stop sending promotional communications.
        </P>
        <P>
          Please note that you may still receive essential communications relating to your orders,
          transactions, account, or other services.
        </P>
      </Section>

      <Section n={12} title="Changes to This Privacy Policy">
        <P>
          Vero Goods may update this Privacy Policy from time to time to reflect changes in our
          services, technology, legal requirements, or business practices.
        </P>
        <P>
          Any updated version will be published on this page with a revised &ldquo;Last
          Updated&rdquo; date.
        </P>
        <P>We encourage you to periodically review this Privacy Policy.</P>
      </Section>

      <Section n={13} title="Contact Us">
        <P>
          If you have questions, concerns, or requests regarding this Privacy Policy or your
          personal information, please contact us:
        </P>
        <ContactCard />
      </Section>
    </LegalPage>
  );
}
