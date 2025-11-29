# PayFriends GroupTabs: Design Proposals

This document outlines nine distinct design directions for the PayFriends GroupTabs feature, with a specific focus on improving the "Restaurant Dinner" flow.

---

## Proposal 1: "The Smart Receipt" (Skeuomorphic 2.0)

### 1. Concept Name
**The Smart Receipt**

### 2. Visual Style Description
A digital reimagining of a physical receipt. The interface uses a high-contrast, "glowing" receipt aesthetic set against the dark PayFriends background. The receipt itself is a long, continuous vertical card with jagged "torn" edges at the bottom. It grounds the abstract concept of a digital split in a familiar physical object.

### 3. Layout Structure
*   **Overview:** A "wallet" view where active tabs look like receipt slips stacked vertically, peeking out from each other.
*   **Wizard:** You are "printing" a new receipt. Inputs slide in line-by-line as if being printed.
*   **Detail Page:** The main view is the long receipt card. Expenses are listed like line items. Participants are visualized as "signatures" or stamps at the bottom of the receipt.

### 4. Typography + Spacing Rules
*   **Typography:** A mix of the standard app font (Inter/System) for UI controls and a modern monospaced font (e.g., `Courier Prime`, `Space Mono`, or `JetBrains Mono`) for the receipt content itself.
*   **Spacing:** Tight vertical spacing within the receipt to mimic real prints; generous spacing outside the receipt to focus attention.

### 5. Icon Style
Line-art, stroke-based icons that look like they could be printed by a thermal printer (1px stroke, no fill).

### 6. User Interaction
Vertical scrolling is the primary interaction. Adding an item adds a line to the receipt with a satisfying "chk-chk" sound and micro-animation. Splitting is done by tapping a line item and assigning "stamps" (user avatars) to it.

### 7. The "Restaurant Dinner" Flow
1.  **Start:** User taps "New Receipt". A blank receipt scrolls up.
2.  **Total:** User types the total amount. It appears as "TOTAL ......... €120.00" at the bottom.
3.  **Split:** User toggles "Split Mode". Options appear as checkboxes on the receipt: `[x] Equal`, `[ ] Itemized`.
4.  **Share:** A "Tear & Share" button at the top. Tapping it plays a ripping animation and generates the link.
5.  **Joining:** When friends join, their avatars appear "stamped" on the bottom of the receipt in red/blue ink style.

### 8. Microcopy Ideas
*   "Printing bill..."
*   "Tearing off receipt..."
*   "Add your signature"
*   "Verified Purchase"

### 9. Why this proposal is good
It uses a strong mental model (everyone knows how a receipt works). It feels tangible and reliable, making the "money" part feel more real.

### 10. Target User
Users who love order and clarity; older Gen Z/Millennials who appreciate retro-tech aesthetics (thermal printer vibes).

---

## Proposal 2: "Social Orbit" (Visual/Spatial)

### 1. Concept Name
**Social Orbit**

### 2. Visual Style Description
Visualizes the group as a solar system. The "Bill" is the sun (a glowing central orb), and participants are planets orbiting it. The distance or size of the planets represents their share or payment status. Deep space background with glowing neon rings.

### 3. Layout Structure
*   **Overview:** A "Galaxy View" of all your groups, scattered across a dark canvas.
*   **Wizard:** You create a new "Star" (the bill).
*   **Detail Page:** Central total amount. Avatars float around it in concentric rings.

### 4. Typography + Spacing Rules
*   **Typography:** Geometric sans-serif (e.g., `Futura` or `Circular`). Wide letter spacing for headers.
*   **Spacing:** Airy, open layout. No lists; everything is free-floating.

### 5. Icon Style
Circular, filled icons with glowing outer shadows (neon effect).

### 6. User Interaction
Drag-and-drop is the core mechanic. To assign a cost, you drag a "coin" from the center to a person. To pay, a user drags their planet into the sun.

### 7. The "Restaurant Dinner" Flow
1.  **Start:** "Launch a Bill". A glowing orb appears in the center.
2.  **Total:** User taps the sun to set the mass (amount): "€120".
3.  **People:** User adds friends. They pop in as small planets orbiting the sun.
4.  **Split:** Default is equal distance. If someone owes more, their planet grows larger. If someone pays, their planet turns green.
5.  **Fairness:** A "Gravity" toggle pulls everyone to the same orbit (equal split).

### 8. Microcopy Ideas
*   "Launch Tab"
*   "Orbiting: 4 friends"
*   "Gravity Split"
*   "Black Hole" (for the total)

### 9. Why this proposal is good
Highly visual and social. It makes "who hasn't paid" immediately obvious (they are red or far away). It gamifies the layout without being a full game.

### 10. Target User
Visual thinkers, designers, and younger users who dislike spreadsheets and standard lists.

---

## Proposal 3: "Chat Stream" (Conversational)

### 1. Concept Name
**Chat Stream**

### 2. Visual Style Description
Treats the bill split as a chat conversation. Since most users coordinate bills in WhatsApp/iMessage anyway, this brings the UI to them. It looks like a messenger app.

### 3. Visual Style & Layout
*   **Overview:** Looks like a message inbox. "Dinner with Sarah" is a thread.
*   **Wizard:** A "chatbot" interface. The app asks questions, you reply.
*   **Detail Page:** A live feed of activity. "John joined", "Sarah paid €30", interspersed with "Bill Cards".

### 4. Typography + Spacing Rules
*   **Typography:** System fonts (San Francisco/Inter) to feel native and familiar.
*   **Spacing:** Standard chat bubble spacing.

### 5. Icon Style
Emoji-heavy. The UI relies on emojis for categories and status updates.

### 6. User Interaction
Input fields look like chat bars. Actions are "quick replies" (pill-shaped buttons) at the bottom of the screen.

### 7. The "Restaurant Dinner" Flow
1.  **Start:** Bot asks: "How much was dinner?"
2.  **Input:** User types "120".
3.  **Bot:** "Split equally between 4 people?"
4.  **Input:** User taps "Yes" quick reply.
5.  **Bot:** "Great. Here is the magic link 🔗. Share it!"
6.  **Detail:** The chat log shows "Paul created the tab", "Mike joined", "Alice paid €30".

### 8. Microcopy Ideas
*   "Ask for money"
*   "Nudge everyone"
*   "Settle up"
*   "Say thanks"

### 9. Why this proposal is good
Zero learning curve. It feels natural, less "admin-heavy," and fits into the existing mental model of how friends communicate.

### 10. Target User
Casual users who find forms intimidating; people who live in group chats.

---

## Proposal 4: "Story Mode" (Immersive)

### 1. Concept Name
**Story Mode**

### 2. Visual Style Description
Takes inspiration from Instagram/Snapchat Stories. Every step is full-screen, immersive, and linear. No vertical scrolling—just tapping to advance.

### 3. Layout Structure
*   **Overview:** A horizontal carousel of "Active Stories" (Tabs) at the top (like Instagram).
*   **Wizard:** One question per screen. Huge tap targets.
*   **Detail Page:** A dashboard that feels like a "Profile" page with a summary story highlight.

### 4. Typography + Spacing Rules
*   **Typography:** Huge, bold headers (60px+). Minimal body text. Text overlays on gradients.
*   **Spacing:** Edge-to-edge touch targets.

### 5. Icon Style
Minimalist, thin outlines (white on dark backgrounds).

### 6. User Interaction
Tap right edge to advance, tap left to go back. Swipe up to see the detailed breakdown. Long-press to see payment info.

### 7. The "Restaurant Dinner" Flow
1.  **Screen 1:** "How much?" (Big number pad overlay). User enters 120.
2.  **Screen 2:** "Who's splitting?" (Quick contact picker bubbles).
3.  **Screen 3:** "Photo?" (Camera viewfinder opens to snap the receipt).
4.  **Screen 4:** "Sent!" (Confetti animation). The "Story" is now live for friends to tap through.

### 8. Microcopy Ideas
*   "Your turn"
*   "Next"
*   "Snap receipt"
*   "All caught up"

### 9. Why this proposal is good
Extremely focused. Impossible to get lost. Mobile-first and thumb-friendly.

### 10. Target User
Gen Z, social media natives who value speed, aesthetics, and "tapping" over "scrolling".

---

## Proposal 5: "Neon Arcade" (Gamified)

### 1. Concept Name
**Neon Arcade**

### 2. Visual Style Description
Cyberpunk / Synthwave aesthetic. Deep purple/black backgrounds, hot pink and bright cyan accents. Turns the bill into a "Boss Monster" to be defeated.

### 3. Layout Structure
*   **Overview:** "Level Select" screen.
*   **Wizard:** Character selection screen (choosing the bill type).
*   **Detail Page:** Health bars represent the amount left to pay.

### 4. Typography + Spacing Rules
*   **Typography:** Arcade-style headers (e.g., `Press Start 2P` or similar pixel nuances) combined with clean sans-serif for readability.
*   **Spacing:** Blocky, grid-based layout.

### 5. Icon Style
Pixel art or 8-bit inspired vectors.

### 6. User Interaction
Buttons bounce when pressed. Toggles flick with haptic feedback. Progress bars fill up like power-ups. Sound effects for actions (coins clinking).

### 7. The "Restaurant Dinner" Flow
1.  **Spawn:** User "Spawns" a new bill.
2.  **Boss HP:** User sets the "Boss HP" (Total Amount: €120).
3.  **Players:** Friends join as "Player 1", "Player 2", etc.
4.  **Battle:** The bill is a monster in the center. As friends pay, they "deal damage" to the bill.
5.  **Victory:** When the bill reaches 0, a "K.O." or "Victory" screen appears.

### 8. Microcopy Ideas
*   "Spawn Bill"
*   "Defeat the Debt"
*   "Player 1 Ready"
*   "K.O."
*   " Loot Distribution"

### 9. Why this proposal is good
Makes a painful task (paying money) fun. Reduces social awkwardness around money by turning it into a co-op game.

### 10. Target User
Gamers, tech-savvy friend groups, and younger demographics.

---

## Proposal 6: "Swiss Minimalist" (Fintech Utility)

### 1. Concept Name
**Swiss Minimalist**

### 2. Visual Style Description
Radical simplicity. Stark black background, pure white text, thin hairline dividers. Mint is used *only* for "Paid" status. No decoration, no gradients, just utility.

### 3. Layout Structure
*   **Overview:** A simple tabular list. Date on left, Name in middle, Amount on right.
*   **Wizard:** A modal overlay. Inputs are just underlined text (Mad Libs style).
*   **Detail Page:** A clean ledger/statement view.

### 4. Typography + Spacing Rules
*   **Typography:** `Helvetica Now` or `Inter`. Diverse weights (Bold headers, light details). Large font sizes for numbers.
*   **Spacing:** Precision grid. 1px borders.

### 5. Icon Style
Abstract geometric shapes or no icons at all (text only).

### 6. User Interaction
Instant. No animations. Toggle switches. The interaction is about speed and efficiency.

### 7. The "Restaurant Dinner" Flow
1.  **Input:** A single screen. "Bill Amount: ______". User types "120".
2.  **Split:** "Split between: [ 4 ] people". User types "4".
3.  **Result:** App immediately shows "€30.00 / person".
4.  **Action:** Button: "Copy Link". Done.

### 8. Microcopy Ideas
*   "Split"
*   "Share"
*   "Pay"
*   "Settled"

### 9. Why this proposal is good
Feels premium, trustworthy, and incredibly fast. "It just works." It builds trust through precision.

### 10. Target User
Professionals, minimalists, heavy fintech users (Revolut Ultra/Metal users).

---

## Proposal 7: "Card Stack" (Tinder-like)

### 1. Concept Name
**Card Stack**

### 2. Visual Style Description
Focuses on decision-making one item at a time. Uses a card-stack interface with depth (shadows, stacking).

### 3. Layout Structure
*   **Overview:** A deck of cards. The top card is the most urgent tab.
*   **Wizard:** One card per question. Swipe right to confirm, left to go back.
*   **Detail Page:** A horizontal stack of expenses or participants.

### 4. Typography + Spacing Rules
*   **Typography:** Large card titles centered on the card.
*   **Spacing:** Cards float in the middle of the screen.

### 5. Icon Style
Rounded, soft icons that feel tactile.

### 6. User Interaction
Swiping gestures. Drag cards to people. The "Tinder swipe" mechanic for approving/rejecting or sorting expenses.

### 7. The "Restaurant Dinner" Flow
1.  **Card 1:** "Where did you eat?" (User types "Pizza Place"). Swipe Right.
2.  **Card 2:** "Total Amount?" (User types "120"). Swipe Right.
3.  **Card 3:** "Who is paying?" (User selects self). Swipe Right.
4.  **Summary:** The final card is the "Bill Card" that you can flip over (tap) to see the details and share.

### 8. Microcopy Ideas
*   "Swipe to split"
*   "Next item"
*   "Flip to view"

### 9. Why this proposal is good
Reduces cognitive load by showing one thing at a time. Great for complex multi-bill trips where you need to review items one by one.

### 10. Target User
Indecisive users, mobile users who prefer one-handed use.

---

## Proposal 8: "Split-Brain" (Data Visualization)

### 1. Concept Name
**Split-Brain**

### 2. Visual Style Description
The interface *is* the data. The main view is a dynamic, interactive Voronoi diagram or Pie Chart that users manipulate directly.

### 3. Layout Structure
*   **Overview:** A bar chart of monthly spending across groups.
*   **Wizard:** A pie chart you "slice" with your finger.
*   **Detail Page:** The chart takes up 50% of the screen. The list of people is below it, color-coded to the chart.

### 4. Typography + Spacing Rules
*   **Typography:** Monospace numbers (`Roboto Mono`). Small caps labels. Technical feel.
*   **Spacing:** Dense information density.

### 5. Icon Style
Data-focused icons (charts, pies, trends, deltas).

### 6. User Interaction
Touching the chart segments expands details. Dragging slice borders changes the split percentage dynamically.

### 7. The "Restaurant Dinner" Flow
1.  **Start:** User sees a full circle (€0).
2.  **Total:** User types €120. The circle fills with color.
3.  **Add People:** User taps "+ Person". The circle splits into 2, then 3, then 4 slices.
4.  **Adjust:** User can drag a slice boundary to change the % (e.g., "John had steak"). The numbers update in real-time.
5.  **View:** Tapping a slice reveals "€45 - John - Unpaid".

### 8. Microcopy Ideas
*   "Distribution"
*   "Fair Share"
*   "Delta"
*   "Variance"

### 9. Why this proposal is good
Immediate visual comprehension of fairness. It makes complex math visible and touchable.

### 10. Target User
"Quantified Self" enthusiasts, math-brained users, engineers.

---

## Proposal 9: "Table Map" (Spatial Reality)

### 1. Concept Name
**Table Map**

### 2. Visual Style Description
Mimics the physical reality of a dinner table. Uses a top-down view of a table (circle or rectangle) with seats around it.

### 3. Layout Structure
*   **Overview:** List of "Active Tables".
*   **Wizard:** "Set the table" interface.
*   **Detail Page:** The table view. Items (wine, pizza) are placed on the table visually.

### 4. Typography + Spacing Rules
*   **Typography:** Friendly rounded sans-serif (e.g., `Nunito` or `Rounded Mplus`).
*   **Spacing:** Spatial spacing relative to the "table" in the center.

### 5. Icon Style
Food items, chairs, plates, cutlery.

### 6. User Interaction
Drag items to specific seats (individual pay) or to the center (shared pay). Tap a seat to claim it.

### 7. The "Restaurant Dinner" Flow
1.  **Setup:** "How many seats?" (User selects 4). Four chairs appear around a round table.
2.  **Items:** User drags "Pizza (€20)" to the center (it highlights all 4 seats).
3.  **Specifics:** User drags "Beer (€5)" to Seat 1.
4.  **Summary:** Tapping a seat shows the total for that person: "Pizza (1/4) + Beer = €10".

### 8. Microcopy Ideas
*   "Who had the calamari?"
*   "Shared items"
*   "On the table"
*   "Claim seat"

### 9. Why this proposal is good
Solves the "I didn't have any wine" problem intuitively without math. It maps perfectly to the real-world experience of dining out.

### 10. Target User
Groups who eat out frequently and hate "unfair" even splits; foodies.

