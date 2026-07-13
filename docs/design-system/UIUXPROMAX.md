# WinBrain UIUXPROMAX Design System

Source skill: `nextlevelbuilder/ui-ux-pro-max-skill`

## Product classification

- Product type: enterprise AI operations workspace / AI copilot platform
- Primary users: business experts, operations administrators, data teams, Skill maintainers
- Core task: turn expert knowledge into governed, reusable, versioned AI Skills

## Recommended pattern

**Command workspace + structured review canvas**

The desktop experience keeps the main production workflow in one view:

1. Define organization and expert context.
2. Interview the expert through the copilot panel.
3. Generate a Skill draft.
4. Review `SKILL.md` and eval content.
5. Publish into the scoped Skill Store.

## Visual direction

- Swiss modernism for information hierarchy and density
- AI-native interaction patterns for the persistent copilot
- Restrained enterprise surfaces rather than decorative gradients
- Deep teal as the action and system-status color
- Dark editor and assistant surfaces to distinguish generative work from configuration

## Design tokens

| Token | Value | Purpose |
| --- | --- | --- |
| Ink | `#10212b` | Primary text |
| Muted | `#667984` | Secondary information |
| Canvas | `#f4f7f7` | Application background |
| Surface | `#ffffff` | Cards and panels |
| Brand | `#0f766e` | Primary actions and active navigation |
| Brand strong | `#0b5f59` | Hover and pressed actions |
| Brand soft | `#dff3ef` | Selected states |
| Accent | `#ca8a04` | Exceptional emphasis only |
| Success | `#087f5b` | Healthy and completed states |
| Danger | `#b42318` | Destructive and error states |

## Interaction rules

- Every actionable control must have a visible hover state.
- Keyboard focus uses a visible 3px teal focus ring.
- Motion remains between 150–200ms and respects `prefers-reduced-motion`.
- Buttons use semantic labels; decorative symbols must not be the only accessible name.
- The primary workflow remains usable at 375px, 768px, 1024px, and 1440px widths.
- Text and control contrast should meet WCAG AA.

## Anti-patterns avoided

- Decorative AI purple/pink gradients as the primary identity
- Excessive glassmorphism and low-contrast translucent surfaces
- Emoji-only functional controls
- Large empty marketing-style hero areas inside the operational workspace
- Multiple competing primary actions
- Animation that delays workflow completion

## Implementation

The design layer is implemented in:

- `apps/business-skill-studio/app/uiux-promax.css`
- imported last from `apps/business-skill-studio/app/layout.tsx`

Loading the stylesheet last provides a reversible migration path and avoids changes to application behavior, API calls, persistence, authentication, and Agent SDK streaming.
