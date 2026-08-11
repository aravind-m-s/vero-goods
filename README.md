# Vero Goods --- Next.js E-commerce Application

> This document is the product specification.
> For installation, environment variables, payments/webhook configuration and
> deployment, see [SETUP.md](SETUP.md).

## Purpose

Build a clean, minimal e-commerce application with two areas:

-   **User storefront** --- browse products, view product details, place
    orders, pay, and track orders.
-   **Admin dashboard** --- manage products, product technical-detail
    tables, orders, statuses, and exports.

The application must be production-oriented, responsive, accessible, and
easy to extend.

------------------------------------------------------------------------

# 1. Technology Stack

Use the following stack:

-   **Next.js** --- App Router
-   **TypeScript** --- strict typing
-   **React**
-   **shadcn/ui** --- UI primitives and components
-   **Tailwind CSS**
-   **Lucide React** --- icons
-   **React Hook Form + Zod** --- forms and validation
-   **Supabase** --- PostgreSQL database + authentication + server-side
    data access
-   **Razorpay** --- online payments
-   **Resend or an equivalent transactional email provider** --- order
    emails
-   Use server actions / route handlers where appropriate.
-   Keep secrets strictly server-side.

If the existing project already has a backend/database/authentication
layer, preserve it instead of introducing a duplicate backend.

------------------------------------------------------------------------

# 2. General Product Requirements

The application is an e-commerce website for India.

## Design principles

The UI should be:

-   Clean
-   Minimal
-   Modern
-   Premium but not visually heavy
-   Mobile-first
-   Responsive
-   Accessible
-   Fast
-   Consistent across admin and storefront

Avoid:

-   Excessive gradients
-   Excessive shadows
-   Large decorative elements
-   Unnecessary animations
-   Cluttered dashboards
-   Overly rounded UI everywhere

Use subtle borders, restrained spacing, good typography, and clear
hierarchy.

------------------------------------------------------------------------

# 3. Application Structure

Use Next.js App Router.

Suggested structure:

``` text
app/
  (store)/
    page.tsx
    products/
      page.tsx
      [slug]/
        page.tsx
    checkout/
      page.tsx
    order/
      success/
        page.tsx
      track/
        [token]/
          page.tsx

  admin/
    page.tsx
    products/
      page.tsx
      new/
        page.tsx
      [id]/
        page.tsx
        edit/
          page.tsx
    orders/
      page.tsx
      [id]/
        page.tsx

  api/
    payments/
      razorpay/
        create-order/
          route.ts
        verify/
          route.ts
    orders/
      route.ts
      [id]/
        route.ts
      tracking/
        [token]/
          route.ts
    email/
      order-confirmation/
        route.ts

components/
  ui/
  products/
  orders/
  admin/
  checkout/

lib/
  db/
  auth/
  payments/
  email/
  validations/
  utils/

types/
```

Adjust the structure if a better Next.js App Router organization is
appropriate, but keep feature boundaries clear.

------------------------------------------------------------------------

# 4. Data Model

Create a normalized database schema.

## Product

A product should contain at minimum:

``` text
Product
- id
- title
- slug
- description
- price
- compareAtPrice (optional)
- currency
- images
- isActive
- createdAt
- updatedAt
```

The requirements explicitly mention Title and Description. Price is
required for checkout/payment functionality.

## Product Technical Details

Technical details must be dynamic.

Do NOT hard-code fields such as Brand, Manufacturer, Colour, etc.

Use a structure similar to:

``` text
ProductSpecification
- id
- productId
- heading
- sortOrder
- createdAt
- updatedAt

ProductSpecificationRow
- id
- specificationId
- label
- value
- sortOrder
```

This allows the admin to create multiple specification tables/sections.

Example:

``` text
Heading:
Technical Details

Rows:
Brand              | Zidea
Manufacturer       | Anycubic
Country of Origin  | China
Colour             | Black
Item Weight        | 9 kg 250 g
Product Dimensions | 38.1 x 50.8 x 50.8 cm; 9.25 kg
Item Height        | 20 Inches
Item Width         | 20 Inches
Operating System   | Linux
Compatible Device  | Laptop, Personal Computer, Smartphone
Included Components| 1*3D Printer
```

The exact example above is only a visual/data example. The
implementation must support arbitrary headings, rows, labels, and
values.

------------------------------------------------------------------------

# 5. Admin Side

## 5.1 Admin Authentication

Admin routes must be protected.

Unauthenticated users must not be able to access:

``` text
/admin
/admin/products
/admin/orders
```

Use server-side authorization checks.

Do not rely only on hiding UI elements.

------------------------------------------------------------------------

# 6. Admin Product CRUD

Create a complete Product CRUD interface.

## Product List

Display:

-   Product image
-   Product title
-   Price
-   Status
-   Created date
-   Actions

Actions:

-   View
-   Edit
-   Delete
-   Copy product URL

Include:

-   Search
-   Filtering by active/inactive status
-   Pagination if required

Use shadcn/ui components such as:

-   Table
-   Input
-   Button
-   DropdownMenu
-   Badge
-   Dialog
-   AlertDialog

------------------------------------------------------------------------

# 7. Product Create/Edit

The product form should contain:

## Basic information

-   Title
-   Description
-   Price
-   Optional compare-at price
-   Product images
-   Active/inactive status

## Technical Details

Provide an admin UI for creating one or more specification sections.

Example UI:

``` text
Technical Details

Heading
[ Technical Details                         ]

Rows

[ Brand              ] [ Zidea                  ] [Delete]
[ Manufacturer       ] [ Anycubic               ] [Delete]
[ Country of Origin  ] [ China                  ] [Delete]

[ + Add Row ]

[ + Add Specification Section ]
```

Each section should support:

-   Heading
-   Multiple rows
-   Row label
-   Row value
-   Reordering rows
-   Deleting rows

Allow multiple specification sections.

Example:

``` text
Technical Details
-----------------
Brand              Zidea
Manufacturer       Anycubic
Country of Origin  China

Dimensions
----------
Height             20 Inches
Width              20 Inches
```

------------------------------------------------------------------------

# 8. Technical Details Customer UI

On the product details page, render the specification section similar to
the provided reference image.

The design should be:

``` text
Technical Details

------------------------------------------------
Brand                  Zidea
------------------------------------------------
Manufacturer           Anycubic
------------------------------------------------
Country of Origin      China
------------------------------------------------
Colour                 Black
------------------------------------------------
Item Weight            9 kg 250 g
------------------------------------------------
...
```

Requirements:

-   Heading above the table
-   Two-column layout
-   Label column + value column
-   Horizontal separators
-   Compact rows
-   Responsive on mobile
-   Long values should wrap correctly
-   Do not use a heavy bordered grid
-   Preserve admin-defined row order

On mobile, use a responsive layout rather than allowing the table to
break the page.

------------------------------------------------------------------------

# 9. Product URL

Every product must have a stable public URL.

Example:

``` text
/products/anycubic-3d-printer
```

The admin product page must provide:

``` text
Copy Product URL
```

Clicking it should copy the full public URL to the clipboard.

Show a small toast:

``` text
Product URL copied
```

------------------------------------------------------------------------

# 10. Orders --- Admin

Create an admin order management page.

## Order List

Display:

-   Order ID
-   Customer email
-   Customer name
-   Total amount
-   Payment method
-   Payment status
-   Order status
-   Created date
-   Actions

Support:

-   Search by order ID
-   Search by customer email
-   Filter by order status
-   Filter by payment method
-   Date range filter
-   Pagination

------------------------------------------------------------------------

# 11. Order Status

The admin is the only side allowed to change order status.

Statuses:

``` text
Order placed
Confirmed
Packed
Shipped
Out for delivery
Delivered
Cancelled
```

Use a controlled state transition system.

Recommended status values internally:

``` text
PLACED
CONFIRMED
PACKED
SHIPPED
OUT_FOR_DELIVERY
DELIVERED
CANCELLED
```

Display human-readable labels in the UI.

The customer must never be able to manually change the order status.

------------------------------------------------------------------------

# 12. Order Details

Admin order details page should show:

## Customer

-   Name
-   Email
-   Phone
-   Billing address
-   Shipping address

## Order

-   Order ID
-   Created date
-   Products
-   Quantity
-   Unit price
-   Total
-   Taxes if applicable
-   Shipping charge if applicable
-   Grand total

## Payment

-   Payment method
-   Payment status
-   Razorpay payment/order ID when applicable

## Status

Show the current status prominently.

Provide an admin-only status update control.

Example:

``` text
Current Status

[ Packed ▼ ]

Timeline

✓ Order placed
✓ Confirmed
✓ Packed
○ Shipped
○ Out for delivery
○ Delivered
```

------------------------------------------------------------------------

# 13. Order Export

Provide an export button on the admin order page.

Minimum requirement:

``` text
Export Orders
```

Preferred functionality:

``` text
Status:
[ All ]

Date From:
[ date ]

Date To:
[ date ]

[ Export CSV ]
```

The export should support:

-   All statuses
-   Specific order status
-   Date range
-   CSV format

CSV columns should include at minimum:

``` text
Order ID
Created At
Customer Name
Customer Email
Phone
Total
Payment Method
Payment Status
Order Status
```

Perform export server-side when appropriate.

Do not expose sensitive database credentials or secrets to the browser.

------------------------------------------------------------------------

# 14. User Authentication

Do NOT show a login/signup screen when the user first opens the website.

Users should be able to:

-   Browse products
-   View product details
-   Add items / proceed toward checkout

without authentication.

Authentication should be requested only when the user attempts to place
an order.

## Email Authentication Flow

At checkout:

``` text
User clicks "Place Order"

        ↓

Check authentication

        ↓

Not authenticated?

        ↓

Request email authentication

        ↓

Verify email / authenticate

        ↓

Continue checkout

        ↓

Create order
```

Use passwordless email authentication if supported by the chosen auth
provider.

Do not force account creation before browsing.

------------------------------------------------------------------------

# 15. Checkout

Checkout is available only for delivery addresses in India.

Collect:

-   Email
-   Full name
-   Phone number
-   Address
-   Address line 2
-   City
-   State
-   PIN code
-   Country

Country must be fixed to:

``` text
India
```

Do not allow international orders at this stage.

Validate Indian PIN code and phone number format appropriately.

------------------------------------------------------------------------

# 16. Payment Methods

Support:

## Razorpay

Allow online payment through Razorpay.

Important:

-   Razorpay keys must never be exposed through client-side source code
    except the publishable/key ID where appropriate.
-   Create Razorpay orders server-side.
-   Verify payment signatures server-side.
-   Never mark an order as paid solely because the client reports
    success.
-   Store Razorpay order/payment identifiers.

## Cash on Delivery

Allow:

``` text
Cash on Delivery
```

COD orders should not require Razorpay payment.

The payment status should clearly distinguish:

``` text
PENDING
PAID
FAILED
COD
REFUNDED
```

Use appropriate internal enums.

------------------------------------------------------------------------

# 17. Order Creation

Order creation must be transactional.

Recommended sequence:

``` text
Checkout
   ↓
Validate customer information
   ↓
Validate product availability/price server-side
   ↓
Authenticate customer
   ↓
Create pending order
   ↓
Payment
   ↓
Verify payment server-side
   ↓
Update payment status
   ↓
Set order status = PLACED
   ↓
Generate tracking token
   ↓
Send confirmation email
   ↓
Redirect to tracking page
```

Never trust product price, total, or payment state sent directly from
the browser.

Recalculate totals server-side.

------------------------------------------------------------------------

# 18. Order Tracking

Every successful order must receive a tracking URL.

Example:

``` text
/order/track/<secure-token>
```

Do not expose sequential database IDs as the only tracking credential.

Use a cryptographically secure tracking token.

The tracking URL should be:

-   Shareable
-   Read-only
-   Accessible without admin privileges
-   Difficult to guess
-   Associated with exactly one order

------------------------------------------------------------------------

# 19. Order Tracking Page

After placing an order, redirect the customer directly to the tracking
page.

Example:

``` text
Order confirmed!

Order #VG-1024

Thank you for your order.

[ Track Order ]
```

The tracking page should show:

``` text
Order placed
     ↓
Confirmed
     ↓
Packed
     ↓
Shipped
     ↓
Out for delivery
     ↓
Delivered
```

Current state should be visually highlighted.

Cancelled orders should show:

``` text
Cancelled
```

and stop the normal delivery timeline.

The customer must not be able to modify the status.

------------------------------------------------------------------------

# 20. Tracking URL Copy

On the order tracking page provide:

``` text
Copy Tracking URL
```

Show:

``` text
Tracking URL copied
```

Also provide the tracking URL in the order confirmation email.

------------------------------------------------------------------------

# 21. Order Email

After a successful order, send an email containing:

-   Order confirmation
-   Order ID
-   Customer name
-   Product summary
-   Total
-   Payment method
-   Order status
-   Tracking URL

Example:

``` text
Your order has been placed!

Order #VG-1024

[Track your order]

https://example.com/order/track/secure-token
```

The email should use the same clean/minimal visual identity as the
website.

------------------------------------------------------------------------

# 22. Order Status Email

When the admin changes the order status, optionally send an email
notification to the customer.

Recommended statuses that trigger an email:

-   Confirmed
-   Packed
-   Shipped
-   Out for delivery
-   Delivered
-   Cancelled

Email example:

``` text
Your order has been shipped

Order #VG-1024

[Track your order]
```

Make this behavior easy to disable/configure.

------------------------------------------------------------------------

# 23. Storefront

Create a minimal storefront.

## Home/Product Listing

At minimum provide:

-   Product grid
-   Product image
-   Product title
-   Price
-   Product link

Product cards should be clean and responsive.

------------------------------------------------------------------------

# 24. Product Details Page

The product page should include:

-   Product images
-   Title
-   Price
-   Description
-   Technical Details
-   Add to cart / Buy now action
-   Availability/status where applicable

The page should be optimized for mobile.

Use semantic HTML and good accessibility.

------------------------------------------------------------------------

# 25. Cart

Implement a simple cart supporting:

-   Add product
-   Remove product
-   Change quantity
-   Subtotal
-   Total
-   Continue shopping
-   Checkout

Cart state can initially be client-side.

However, all final pricing and product information must be validated
server-side before order creation.

------------------------------------------------------------------------

# 26. Error Handling

Every major flow must handle:

-   Network failures
-   Invalid form data
-   Authentication failure
-   Payment failure
-   Duplicate payment callback
-   Expired tracking token
-   Missing product
-   Deleted/inactive product
-   Invalid order
-   Unauthorized admin access

Use user-friendly error messages.

Never expose:

-   Stack traces
-   Database errors
-   API keys
-   Internal implementation details

------------------------------------------------------------------------

# 27. Loading States

Use shadcn skeletons/loading states.

Examples:

``` text
Product list → Skeleton cards
Product details → Skeleton content
Orders → Skeleton table
Checkout → Button loading state
Payment → Processing state
```

Prevent duplicate order/payment submission while a request is in
progress.

------------------------------------------------------------------------

# 28. Empty States

Provide intentional empty states.

Examples:

``` text
No products found

No orders found

Your cart is empty

No matching orders for the selected filters
```

Avoid blank screens.

------------------------------------------------------------------------

# 29. Responsive Design

The application must work well on:

-   Mobile
-   Tablet
-   Desktop

Admin tables should handle small screens gracefully.

For mobile:

-   Convert complex tables into cards where appropriate.
-   Keep important actions easily accessible.
-   Avoid horizontal scrolling unless genuinely necessary.

------------------------------------------------------------------------

# 30. Accessibility

Follow accessible UI practices:

-   Proper labels
-   Keyboard navigation
-   Visible focus states
-   Semantic HTML
-   Accessible dialogs
-   Accessible dropdowns
-   Accessible buttons
-   Sufficient contrast
-   Screen-reader-friendly status messages

Use shadcn/ui components wherever appropriate.

------------------------------------------------------------------------

# 31. Security Requirements

Implement security as a first-class requirement.

## Admin

-   Protect all admin routes server-side.
-   Verify admin authorization on every mutation.
-   Never trust client-side role information.

## Orders

-   Never trust client-submitted prices.
-   Never trust client-submitted payment status.
-   Never trust client-submitted order status.
-   Validate product state server-side.
-   Validate order ownership/access.

## Payments

-   Razorpay signature verification must happen server-side.
-   Handle webhook/idempotency safely.
-   Do not create duplicate orders for repeated callbacks.

## Tracking

-   Use secure random tracking tokens.
-   Do not expose sensitive customer data unnecessarily.
-   Tracking URLs should only reveal the minimum information required.

------------------------------------------------------------------------

# 32. Validation

Use Zod schemas for:

-   Product
-   Product specifications
-   Checkout
-   Customer address
-   Order
-   Order status
-   Payment callbacks
-   Export filters

Keep validation schemas reusable between server and client where
possible.

------------------------------------------------------------------------

# 33. UI Components

Prefer shadcn/ui components:

``` text
Button
Input
Textarea
Label
Form
Select
DropdownMenu
Dialog
AlertDialog
Table
Badge
Card
Tabs
Separator
Toast / Sonner
Skeleton
Calendar
Popover
Sheet
Breadcrumb
```

Do not build custom versions of components that already exist in
shadcn/ui unless there is a clear reason.

------------------------------------------------------------------------

# 34. Admin Navigation

Use a clean admin sidebar.

Suggested navigation:

``` text
Vero Goods

Dashboard

Catalog
  Products

Orders
  All Orders
```

At the bottom:

``` text
Admin
Settings / Logout
```

The dashboard itself can initially be simple.

Do not build unnecessary analytics unless explicitly requested.

------------------------------------------------------------------------

# 35. Admin Dashboard

Create a lightweight overview page.

Show:

``` text
Total Orders
Pending Orders
Delivered Orders
Cancelled Orders
Total Revenue
```

Use simple cards.

Avoid adding complex charts unless there is useful data to visualize.

------------------------------------------------------------------------

# 36. URL and SEO Requirements

Use meaningful slugs.

Example:

``` text
/products/anycubic-kobra-3d-printer
```

Product pages should provide:

-   Dynamic metadata
-   Title
-   Description
-   Open Graph metadata
-   Canonical URL where appropriate

Use Next.js metadata APIs.

------------------------------------------------------------------------

# 37. Environment Variables

Use environment variables for all secrets.

Example:

``` env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

RESEND_API_KEY=

NEXT_PUBLIC_APP_URL=
```

Never commit `.env.local`.

Create:

``` text
.env.example
```

with variable names only.

------------------------------------------------------------------------

# 38. Database Rules

Use proper database constraints.

Examples:

-   Product slug should be unique.
-   Order ID should be unique.
-   Tracking token should be unique.
-   Specification rows should have stable ordering.
-   Order status should use controlled values.
-   Payment identifiers should be indexed where useful.

Add timestamps:

``` text
created_at
updated_at
```

where appropriate.

------------------------------------------------------------------------

# 39. Code Quality

Use strict TypeScript.

Avoid:

``` text
any
```

unless there is a documented reason.

Prefer:

-   Typed database models
-   Typed API responses
-   Reusable validation schemas
-   Small components
-   Feature-based organization
-   Server-side data fetching where appropriate
-   Server actions for mutations where appropriate

Do not put business logic directly inside large page components.

------------------------------------------------------------------------

# 40. Important Business Rules

These rules are mandatory:

1.  Customers can browse without logging in.
2.  Authentication is requested only when the customer proceeds to place
    an order.
3.  Orders can only be delivered within India.
4.  Admin is the only role that can change order status.
5.  Product URLs must be copyable from admin.
6.  Tracking URLs must be generated for successful orders.
7.  Tracking URLs must be copyable.
8.  Customer should be redirected to tracking after successful order
    placement.
9.  Tracking URLs must be sent by email.
10. Razorpay payments must be verified server-side.
11. COD must be supported.
12. Product technical details must be dynamic.
13. Technical details must support a heading and arbitrary rows.
14. Admin must be able to export orders.
15. Export should support order status and date-range filtering.
16. All final prices must be calculated/validated server-side.

------------------------------------------------------------------------

# 41. Suggested Order State Model

Use:

``` ts
export enum OrderStatus {
  PLACED = "PLACED",
  CONFIRMED = "CONFIRMED",
  PACKED = "PACKED",
  SHIPPED = "SHIPPED",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}
```

Payment status:

``` ts
export enum PaymentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  COD = "COD",
  REFUNDED = "REFUNDED",
}
```

------------------------------------------------------------------------

# 42. Recommended Order Tables

A practical schema can include:

``` text
users
- id
- email
- name
- phone
- role
- created_at
- updated_at

products
- id
- title
- slug
- description
- price
- compare_at_price
- currency
- is_active
- created_at
- updated_at

product_images
- id
- product_id
- url
- sort_order

product_specifications
- id
- product_id
- heading
- sort_order

product_specification_rows
- id
- specification_id
- label
- value
- sort_order

orders
- id
- order_number
- user_id
- email
- customer_name
- phone
- shipping_address
- total_amount
- payment_method
- payment_status
- order_status
- tracking_token
- razorpay_order_id
- razorpay_payment_id
- created_at
- updated_at

order_items
- id
- order_id
- product_id
- product_title
- unit_price
- quantity
- total
```

Snapshot product title and price in `order_items` so historical orders
do not change when the product is edited later.

------------------------------------------------------------------------

# 43. Implementation Priorities

Build in this order:

## Phase 1 --- Foundation

-   Next.js setup
-   TypeScript
-   Tailwind
-   shadcn/ui
-   Database
-   Authentication
-   Environment configuration
-   Base layout

## Phase 2 --- Products

-   Product schema
-   Product CRUD
-   Product images
-   Technical specification builder
-   Product listing
-   Product details
-   Copy product URL

## Phase 3 --- Cart and Checkout

-   Cart
-   Checkout
-   India-only address validation
-   Email authentication at checkout

## Phase 4 --- Orders

-   Order creation
-   Order details
-   Admin order list
-   Admin order status changes
-   Order tracking

## Phase 5 --- Payments

-   Razorpay
-   COD
-   Payment verification
-   Failure handling
-   Idempotency

## Phase 6 --- Email

-   Order confirmation email
-   Tracking URL
-   Status update emails

## Phase 7 --- Export and Polish

-   CSV export
-   Status/date filters
-   Responsive polish
-   Loading states
-   Empty states
-   Error states
-   Accessibility
-   SEO
-   Security review

------------------------------------------------------------------------

# 44. Definition of Done

The implementation is considered complete only when:

-   [ ] Admin can create products.
-   [ ] Admin can edit products.
-   [ ] Admin can delete/deactivate products.
-   [ ] Admin can create arbitrary technical-detail sections.
-   [ ] Admin can add/delete/reorder specification rows.
-   [ ] Product technical details visually resemble the provided
    reference.
-   [ ] Admin can copy a product URL.
-   [ ] Users can browse without authentication.
-   [ ] Users are prompted for email authentication at checkout/order
    placement.
-   [ ] Users can purchase from India.
-   [ ] Razorpay works with server-side verification.
-   [ ] COD works.
-   [ ] Orders are created reliably.
-   [ ] Admin can view orders.
-   [ ] Admin can change order status.
-   [ ] Customers cannot change order status.
-   [ ] Customers receive a tracking URL.
-   [ ] Tracking URL can be copied.
-   [ ] Customer is redirected to tracking after order placement.
-   [ ] Tracking page shows order progress.
-   [ ] Admin can filter orders.
-   [ ] Admin can export orders.
-   [ ] Export supports status and date range.
-   [ ] Application is responsive.
-   [ ] Application has proper loading/error/empty states.
-   [ ] Admin routes are protected.
-   [ ] Secrets are not exposed to the client.
-   [ ] No unnecessary `any` types.
-   [ ] `.env.example` is included.
-   [ ] README contains setup instructions.
-   [ ] Production build succeeds without TypeScript errors.

------------------------------------------------------------------------

# 45. AI Agent Implementation Instructions

When implementing this project:

1.  First inspect the existing repository before creating files.
2.  Reuse existing dependencies and architecture when possible.
3.  Do not replace working infrastructure unnecessarily.
4.  Use shadcn/ui instead of inventing a separate design system.
5.  Keep business logic outside presentation components.
6.  Implement server-side authorization for admin actions.
7.  Implement server-side validation for all mutations.
8.  Treat payment callbacks as untrusted input.
9.  Make order creation and payment handling idempotent.
10. Do not expose secrets in client components.
11. Build responsive UI from the beginning rather than patching mobile
    support later.
12. Do not add features that are not required.
13. Prefer simple solutions over unnecessary abstractions.
14. Keep the UI visually minimal and consistent.
15. Use meaningful loading, empty, success, and error states.
16. Before declaring the implementation complete, run:
    -   TypeScript checks
    -   Lint
    -   Production build
17. Fix all build/type errors before completion.

------------------------------------------------------------------------

# 46. Visual Direction

The overall visual language should feel like a modern premium
e-commerce/SaaS product.

Use:

-   White or very light backgrounds
-   Neutral text colors
-   Subtle borders
-   Restrained use of accent color
-   Clear typography
-   Generous but not excessive whitespace
-   Compact technical tables
-   Simple product cards
-   Minimal admin dashboard
-   Subtle hover/focus states

The technical-details table shown in the supplied reference image should
be treated as the visual reference for that specific component, not as a
requirement to reproduce the entire page exactly.

Do not copy unnecessary Amazon-style UI patterns from the reference
image. Recreate the table's clean two-column specification presentation
using the application's own design system.

------------------------------------------------------------------------

# 47. Final Goal

The final application should feel like a polished, minimal e-commerce
platform called **Vero Goods**, with:

``` text
USER
 ├── Browse products
 ├── View product
 ├── Add to cart
 ├── Checkout
 ├── Email authentication only when ordering
 ├── Razorpay / COD
 └── Track order

ADMIN
 ├── Product CRUD
 ├── Technical specification builder
 ├── Copy product URL
 ├── Order management
 ├── Order status management
 ├── Order filters
 └── CSV export
```

Build the system so that additional products, specification fields,
order statuses, payment methods, and future e-commerce features can be
added without rewriting the core architecture.
