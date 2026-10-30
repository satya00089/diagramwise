# Roadmap: Pricing, usage limits and paid plan

Status: planned, not started. Nothing here is live. Do not publish prices or
limits on the site until the matching product work is done.

Goal: keep Diagramwise free for acquiring users, cover the real costs (cloud,
storage, AI), and be honest about it. Today the site says "free with usage
limits"; this plan makes that statement true and measurable.

## Phase 0: Know the costs (before any limit or price)

- [ ] List monthly costs: hosting, storage, database, collaboration server,
      Sentry, domain, email, and AI API usage.
- [ ] Measure AI cost per feedback review (average and worst case: tokens in
      and out times the model price).
- [ ] Estimate cost per active user per month at 100, 1,000 and 10,000 users.
- [ ] Decide the monthly loss you can accept while growing (the "free budget").

Exit: you know the cost of one AI review and the budget it must fit in.

## Phase 1: Protect the wallet (do before the launch posts)

- [ ] Backend cap on AI feedback per user per day (for example N reviews).
      Count on the server by user ID, never trust the client.
- [ ] Lower caps for anonymous or new accounts; per-IP throttle against abuse.
- [ ] Global daily spending limit and an alert at 50% and 80% of it.
- [ ] Clear error in the app when a limit is reached (what happened, when it
      resets). Reuse the Feedback dialog to ask for more access.
- [ ] Usage counter visible to the signed-in user ("3 of 5 reviews used today").
- [ ] Set a spend limit in the AI provider dashboard as a second safety net.

Exit: one user, or a traffic spike from Show HN, cannot create an unbounded bill.

## Phase 2: Define the plans

Draft structure (numbers to be decided from Phase 0 data):

| Plan | Who | AI feedback | Saved designs | Other |
| --- | --- | --- | --- | --- |
| Free | Everyone | Daily allowance | Limited number | All problems, learning paths, guides, canvas |
| Pro | Regular practice, interview prep | Much higher allowance | Higher or unlimited | Export, collaboration, history |
| Sprint (optional) | 3-month interview preparation | Highest, one payment | Unlimited | No auto-renew |

- [ ] Decide what stays free forever: practice problems, guides, learning paths.
- [ ] Decide what is metered: AI feedback and storage (the real costs).
- [ ] Pick prices from cost per user plus margin; check against comparable tools.
- [ ] Decide on regional pricing and currency.
- [ ] Write the rule for changes: tell users before any limit or price change.

Exit: a one-page plan table with real numbers.

## Phase 3: Billing

- [ ] Choose a provider (Stripe, or Razorpay/Lemon Squeezy for local needs and
      tax handling as merchant of record).
- [ ] Accounts: plan field on the user, plan checked on the server for every
      metered action.
- [ ] Checkout, customer portal (cancel, change plan, invoices), webhooks.
- [ ] Failed payment handling and a grace period.
- [ ] Tax and invoicing (GST/VAT); a refund policy.
- [ ] Update Terms and Privacy pages for payments and data retention.

Exit: a test user can upgrade, use higher limits, and cancel.

## Phase 4: Pricing page and SEO

- [ ] `/pricing` page in the product's UX style (reuse About/guide layout):
      plan cards, comparison, FAQ.
- [ ] Add to routes, sitemap, footer, llms.txt, and prerender.
- [ ] Schema: Offer (price 0 for Free, paid price when live) on the
      WebApplication; FAQPage for pricing questions.
- [ ] Pricing FAQ: "Is Diagramwise free?", "What are the limits?", "Can I
      cancel anytime?", "Do you offer student discounts?"
- [ ] Keep the pricing text identical on the page, FAQ, schema, llms.txt, and
      launch posts. Chatbots quote what they find.
- [ ] Until Phase 3 is done, show Pro as "coming soon" with no price.

## Phase 5: Launch and tune

- [ ] Announce to existing users before enabling paid plans.
- [ ] Track: sign-ups, AI reviews per user, cost per user, conversion to paid,
      churn.
- [ ] Review limits monthly against real cost; adjust with notice.
- [ ] Optional: student, education or open-source discounts.

## Risks

- Promising limits on the site that the backend does not enforce.
- Unbounded AI cost from a traffic spike or abuse.
- Removing a free feature people already depend on; announce changes early.
- Wrong prices ending up in search results and chatbot answers; update every
  place at once (page, FAQ, schema, llms.txt, posts).

## Open questions

- What does one AI review cost on average?
- What is the monthly free budget?
- Free allowance: per day or per week? Anonymous allowed?
- Which payment provider and which countries first?
- Is a 3-month Sprint plan wanted?
