import React from 'react';
import type { Metadata } from 'next';
import {
  Bullets,
  Callout,
  ContactCard,
  LegalPage,
  P,
  Section,
  Steps,
  Subheading,
  SupportEmail,
} from '@/features/storefront/components/legal';

// Static legal copy — no database hit, no revalidation window to reason about.
// Edits ship with a deploy, which is also when the date below should change.
export const dynamic = 'force-static';

const LAST_UPDATED = 'August 15, 2026';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description:
    'Vero Goods terms and conditions covering orders, pricing, shipping and delivery timelines, the 24-hour replacement window, and the unboxing video requirement.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and Conditions"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          Welcome to Vero Goods. By accessing or using our website and placing an order with us, you
          agree to be bound by these Terms and Conditions. Please read them carefully before making
          a purchase.
        </>
      }
      acknowledgement="By placing an order through Vero Goods, you acknowledge that you have read, understood, and agreed to these Terms and Conditions."
    >
      <Section n={1} title="Orders">
        <P>
          By placing an order on Vero Goods, you confirm that the information provided by you is
          accurate and complete.
        </P>
        <P>
          Vero Goods reserves the right to cancel or refuse an order in circumstances including, but
          not limited to:
        </P>
        <Bullets
          items={[
            'Product availability issues',
            'Incorrect pricing or product information',
            'Suspected fraudulent or unauthorized transactions',
            'Inability to deliver to the provided address',
          ]}
        />
        <P>
          If an order is cancelled by us after payment has been made, the applicable amount will be
          refunded through the original payment method or another appropriate method.
        </P>
      </Section>

      <Section n={2} title="Product Information">
        <P>
          We make reasonable efforts to ensure that product descriptions, images, specifications,
          prices, and other information displayed on our website are accurate.
        </P>
        <P>
          However, actual product colors, appearance, packaging, or minor details may vary slightly
          from the images shown on the website due to screen settings, photography, manufacturing
          variations, or packaging changes.
        </P>
      </Section>

      <Section n={3} title="Shipping and Delivery">
        <P>
          Vero Goods generally aims to deliver orders within{' '}
          <strong className="font-semibold text-ink">3–7 business days</strong> from the date the
          order is processed.
        </P>
        <P>
          While we make reasonable efforts to meet this timeframe, delivery may be delayed due to
          unforeseen circumstances, including but not limited to:
        </P>
        <Bullets
          items={[
            'Weather conditions',
            'Natural disasters',
            'Transportation delays',
            'Courier or logistics issues',
            'Public holidays',
            'Government restrictions',
            'Incorrect or incomplete delivery information',
            'Other circumstances beyond our reasonable control',
          ]}
        />
        <P>
          The <strong className="font-semibold text-ink">3–7 business day</strong> timeframe is an
          estimated delivery period and is not an absolute guarantee.
        </P>
        <P>
          Customers are responsible for providing a complete and accurate delivery address and
          contact information when placing an order.
        </P>
      </Section>

      <Section n={4} title="Replacement Policy">
        <P>
          If you receive a product that is damaged, defective, incorrect, or otherwise eligible for
          replacement, you must contact Vero Goods{' '}
          <strong className="font-semibold text-ink">within 24 hours of delivery</strong>.
        </P>

        <Subheading>Package opening video requirement</Subheading>
        <Callout>
          A <strong className="font-semibold">continuous package-opening/unboxing video is
          mandatory for replacement claims.</strong>
        </Callout>
        <P>The video should clearly show:</P>
        <Steps
          items={[
            'The unopened package as received.',
            'The package and shipping label.',
            'The complete opening of the package.',
            'The product and its condition immediately after opening.',
            'Any damage, defect, missing item, or incorrect product.',
          ]}
        />
        <P>
          Replacement claims submitted without a suitable package-opening video may not be accepted.
        </P>
        <P>
          Vero Goods may request additional photographs, videos, order details, or other information
          to verify a replacement claim.
        </P>
      </Section>

      <Section n={5} title="Replacement Eligibility">
        <P>A replacement may be considered in cases where:</P>
        <Bullets
          items={[
            'The product received is damaged.',
            'The product received is defective.',
            'The wrong product was delivered.',
            'An item is missing from the package.',
          ]}
        />
        <P>All replacement requests are subject to verification and approval by Vero Goods.</P>
        <P>
          Products must not have been intentionally damaged, misused, modified, or improperly
          handled by the customer.
        </P>
      </Section>

      <Section n={6} title="Replacement Process">
        <P>
          To request a replacement, contact us at <SupportEmail className="font-semibold text-ink" />{' '}
          within 24 hours of delivery.
        </P>
        <P>Please include:</P>
        <Bullets
          items={[
            'Order number',
            'Customer name',
            'Contact details',
            'Description of the issue',
            'Package-opening video',
            'Relevant photographs, if requested',
          ]}
        />
        <P>
          Once the claim has been reviewed and approved, we will provide further instructions
          regarding the replacement.
        </P>
      </Section>

      <Section n={7} title="Delivery Acceptance">
        <P>
          Customers are advised to inspect the package carefully upon delivery and record a
          continuous package-opening video before opening the package.
        </P>
        <P>
          The package-opening video is particularly important when making a claim for damage,
          missing items, or an incorrect product.
        </P>
      </Section>

      <Section n={8} title="Pricing and Payments">
        <P>
          All prices displayed on the Vero Goods website are subject to change without prior notice.
        </P>
        <P>
          We reserve the right to correct pricing or product information errors. If an order has been
          placed based on an incorrect price or product information, we may contact the customer
          regarding the order or cancel the order where appropriate.
        </P>
      </Section>

      <Section n={9} title="Website Usage">
        <P>You agree not to misuse the Vero Goods website or use it for unlawful purposes.</P>
        <P>You must not attempt to:</P>
        <Bullets
          items={[
            'Gain unauthorized access to our website or systems.',
            'Interfere with the operation of the website.',
            'Submit false or misleading information.',
            'Use the website for fraudulent activities.',
            'Copy or reproduce website content without permission.',
          ]}
        />
      </Section>

      <Section n={10} title="Intellectual Property">
        <P>
          All content available on the Vero Goods website, including logos, branding, product images,
          graphics, text, designs, and other materials, is owned by or licensed to Vero Goods unless
          otherwise stated.
        </P>
        <P>
          Such content may not be copied, reproduced, distributed, modified, or used for commercial
          purposes without prior written permission.
        </P>
      </Section>

      <Section n={11} title="Limitation of Liability">
        <P>
          Vero Goods will make reasonable efforts to provide accurate product information and fulfill
          orders within the estimated delivery timeframe.
        </P>
        <P>
          However, Vero Goods shall not be responsible for delays, losses, or disruptions caused by
          circumstances beyond our reasonable control, including courier delays, natural disasters,
          weather conditions, government restrictions, or other unforeseen events.
        </P>
      </Section>

      <Section n={12} title="Changes to These Terms">
        <P>
          Vero Goods reserves the right to modify or update these Terms and Conditions at any time.
        </P>
        <P>
          Any changes will become effective when the updated Terms and Conditions are published on
          the website. Customers are encouraged to review this page periodically.
        </P>
      </Section>

      <Section n={13} title="Contact Us">
        <P>
          If you have any questions regarding these Terms and Conditions, orders, delivery, or
          replacement requests, please contact us:
        </P>
        <ContactCard />
      </Section>
    </LegalPage>
  );
}
