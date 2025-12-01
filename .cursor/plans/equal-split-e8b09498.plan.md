<!-- e8b09498-a372-4ade-9bf3-c4027b721c8d 8572f0ee-0996-43ef-a92f-67bdef3703d2 -->
# Design Proposals: GroupTabs Views (v2)

## Summary

Create a single interactive HTML file (`public/grouptabs-design-proposals-v2.html`) showcasing 6 distinct design variations for the GroupTabs "Equal Split" and "Price Groups" flows, including the "Magic Link" welcome screen.

## Design Versions

1.  **Minimalist Card**: Clean, whitespace-heavy, thin lines.
2.  **Funky Stamp (Preferred)**: Bold "sticker" aesthetics, rotated stamps, playful iconography (based on wizard style).
3.  **Chat Thread**: Conversational UI where payments look like messages.
4.  **Receipt/Ticket**: jagged-edge paper metaphor, monospaced fonts for data.
5.  **Neon/Dark**: High contrast, glowing accents, dark theme emphasis.
6.  **Story Mode**: Mobile-first, full-screen card carousel layout.

## Implementation Details

### File Structure

-   **File**: `public/grouptabs-design-proposals-v2.html`
-   **Assets**: Reusing `public/css/chat-theme.css` and `public/css/grouptabs.css`.
-   **Scripts**: Inline JS for switching designs and toggling states (Equal/Price Groups, Organizer/Guest).

### Key Components to Mockup

For each of the 6 versions, the following states will be toggleable:

1.  **Magic Link Welcome**: Name capture + Group selection (for Price Groups).
2.  **Equal Split View**: Bill summary, participant list, progress bars.
3.  **Price Group View**: Group breakdown, "Unassigned" states, group selection chips.

### Specific "Funky Stamp" Features (Version 2)

-   Use SVG stamps (like "SUPER EASY", "FAIR!") from the creation wizard.
-   Create new SVG stamps for: "PAID", "OWES", "ORGANIZER", "MEMBER".
-   Rotated badges and playful borders.

### User Interaction

-   Top bar with 6 buttons to switch Design Version.
-   Sub-controls to toggle: `Mode: Equal/PriceGroups` and `Role: Organizer/Guest`.
-   "Approve this Design" button for each version (mock action).

## Next Steps

1.  Create the HTML file skeleton with the switcher logic.
2.  Implement the "Funky Stamp" version first (as it's the user's favorite direction).
3.  Implement the other 5 versions.
4.  Verify responsiveness and dark theme consistency.