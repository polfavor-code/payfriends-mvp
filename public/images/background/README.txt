PayFriends Money Planes Sprite Sheet
======================================

Required file: flying-money-planes.png

This sprite sheet should contain money paper airplane images for multiple currencies.

Expected Layout:
----------------
The sprite sheet should be organized in a grid with the following regions:

Row 1:
- USD plane: x=0, y=0, width=200px, height=100px
- EUR plane: x=200, y=0, width=200px, height=100px
- GBP plane: x=400, y=0, width=200px, height=100px

Row 2:
- CHF plane: x=0, y=100, width=200px, height=100px
- JPY plane: x=200, y=100, width=200px, height=100px

Total sprite sheet dimensions: 600px × 200px

Design Guidelines:
------------------
- Each plane should be a stylized paper airplane made from currency
- Include visual currency indicators (symbols, colors, or bill designs)
- Transparent background (PNG with alpha channel)
- High resolution for crisp display at various sizes
- Consider the PayFriends brand green (#3ddc97) as an accent

Fallback Behavior:
------------------
If the sprite sheet is not available, the component will:
1. Show a loading placeholder initially
2. Fall back to programmatically drawn planes if loading fails
3. Display the currency code on each fallback plane

The animation will work regardless of sprite sheet availability.
