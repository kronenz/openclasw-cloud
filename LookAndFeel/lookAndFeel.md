# OpenClaw Cloud Design System

Production-grade, modern light theme for the OpenClaw Cloud dashboard.

## Design Principles

1. **Clean & Professional** - Minimal visual noise, clear hierarchy
2. **Light Theme First** - White/gray backgrounds, subtle borders
3. **Consistent Spacing** - 4px base grid (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
4. **Accessible** - WCAG 2.1 AA compliant contrast ratios
5. **Responsive** - Mobile-first, breakpoints at 640/768/1024/1280px

## Color Palette

### Primary
| Token | Hex | Usage |
|-------|-----|-------|
| `primary-50` | `#EFF6FF` | Hover backgrounds |
| `primary-100` | `#DBEAFE` | Selected/active backgrounds |
| `primary-500` | `#3B82F6` | Primary buttons, links |
| `primary-600` | `#2563EB` | Primary button hover |
| `primary-700` | `#1D4ED8` | Primary button active |

### Neutral (Gray)
| Token | Hex | Usage |
|-------|-----|-------|
| `gray-50` | `#F9FAFB` | Page background |
| `gray-100` | `#F3F4F6` | Card backgrounds, subtle sections |
| `gray-200` | `#E5E7EB` | Borders, dividers |
| `gray-300` | `#D1D5DB` | Disabled borders |
| `gray-400` | `#9CA3AF` | Placeholder text |
| `gray-500` | `#6B7280` | Secondary text |
| `gray-600` | `#4B5563` | Body text |
| `gray-700` | `#374151` | Headings |
| `gray-800` | `#1F2937` | Primary text |
| `gray-900` | `#111827` | Bold headings |

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| `success-50` | `#F0FDF4` | Success background |
| `success-500` | `#22C55E` | Success icon/text |
| `success-700` | `#15803D` | Success emphasis |
| `warning-50` | `#FFFBEB` | Warning background |
| `warning-500` | `#F59E0B` | Warning icon/text |
| `warning-700` | `#B45309` | Warning emphasis |
| `error-50` | `#FEF2F2` | Error background |
| `error-500` | `#EF4444` | Error icon/text |
| `error-700` | `#B91C1C` | Error emphasis |
| `info-50` | `#EFF6FF` | Info background |
| `info-500` | `#3B82F6` | Info icon/text |

### Surface
| Token | Hex | Usage |
|-------|-----|-------|
| `surface-page` | `#F9FAFB` | Page background |
| `surface-card` | `#FFFFFF` | Card/panel background |
| `surface-sidebar` | `#FFFFFF` | Sidebar background |
| `surface-header` | `#FFFFFF` | Header background |
| `surface-overlay` | `rgba(0,0,0,0.5)` | Modal overlay |

## Typography

Font: `Inter` (primary), `system-ui` (fallback)

| Style | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `heading-xl` | 30px | 700 | 36px | Page titles |
| `heading-lg` | 24px | 600 | 32px | Section titles |
| `heading-md` | 20px | 600 | 28px | Card titles |
| `heading-sm` | 16px | 600 | 24px | Sub-section titles |
| `body-lg` | 16px | 400 | 24px | Primary body text |
| `body-md` | 14px | 400 | 20px | Default body text |
| `body-sm` | 12px | 400 | 16px | Captions, labels |
| `label` | 14px | 500 | 20px | Form labels |
| `mono` | 13px | 400 | 20px | Code, IDs, data |

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Cards, inputs |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | Dropdowns, popovers |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | Modals, dialogs |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | `4px` | Buttons, inputs |
| `radius-md` | `8px` | Cards, panels |
| `radius-lg` | `12px` | Modals, large cards |
| `radius-full` | `9999px` | Badges, avatars |

## Icons

**Library: [Lucide](https://lucide.dev/)**

- Default size: 20px (match body text)
- Small: 16px (inline with body-sm)
- Large: 24px (section headers, empty states)
- Stroke width: 1.5px (default) or 2px (emphasis)
- Color: Inherit from parent text color

### Icon Mapping (Common)

| Concept | Lucide Icon |
|---------|-------------|
| Dashboard | `layout-dashboard` |
| Tenants | `building-2` |
| Users | `users` |
| Billing | `credit-card` |
| Settings | `settings` |
| Health | `heart-pulse` |
| Analytics | `bar-chart-3` |
| Reports | `file-text` |
| Notifications | `bell` |
| Search | `search` |
| Add/Create | `plus` |
| Edit | `pencil` |
| Delete | `trash-2` |
| Close | `x` |
| Menu | `menu` |
| Logout | `log-out` |
| Success | `check-circle` |
| Warning | `alert-triangle` |
| Error | `alert-circle` |
| Info | `info` |
| Up trend | `trending-up` |
| Down trend | `trending-down` |
| Calendar | `calendar` |
| Clock | `clock` |
| Link | `external-link` |
| Copy | `copy` |
| Download | `download` |
| Upload | `upload` |
| Filter | `filter` |
| Sort | `arrow-up-down` |
| Refresh | `refresh-cw` |
| API Key | `key` |
| Integration | `plug` |
| AI/Bot | `bot` |
| Message | `message-square` |
| Mail | `mail` |
| Shield | `shield` |
| Lock | `lock` |
| Globe | `globe` |
| Chevron | `chevron-right`, `chevron-down` |
| Arrow | `arrow-left`, `arrow-right` |

## Components

### Buttons

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| Primary | `primary-600` | white | none | Main CTA |
| Secondary | white | `gray-700` | `gray-300` | Secondary actions |
| Ghost | transparent | `gray-600` | none | Tertiary actions |
| Danger | `error-500` | white | none | Destructive actions |
| Disabled | `gray-100` | `gray-400` | `gray-200` | Disabled state |

Sizes: `sm` (32px height), `md` (36px height), `lg` (40px height)

### Cards

- Background: `surface-card` (white)
- Border: 1px solid `gray-200`
- Radius: `radius-md` (8px)
- Shadow: `shadow-sm`
- Padding: 24px
- Hover (if clickable): `shadow-md`

### Tables

- Header: `gray-50` background, `body-sm` uppercase label, `gray-500` text
- Rows: White background, `gray-200` bottom border
- Hover: `gray-50` background
- Cell padding: 12px 16px

### Form Inputs

- Height: 36px (md), 32px (sm)
- Border: 1px solid `gray-300`
- Radius: `radius-sm` (4px)
- Focus: 2px ring `primary-500`
- Error: Border `error-500`, helper text `error-500`

### Badges/Status Pills

| Status | Background | Text |
|--------|-----------|------|
| Active / Healthy | `success-50` | `success-700` |
| Warning / Degraded | `warning-50` | `warning-700` |
| Error / Unhealthy | `error-50` | `error-700` |
| Info / Default | `info-50` | `primary-700` |
| Neutral | `gray-100` | `gray-700` |

### Sidebar Navigation

- Width: 256px (desktop), collapsible to 64px
- Active item: `primary-50` background, `primary-600` text, left 3px border
- Inactive: `gray-600` text
- Hover: `gray-100` background
- Icon + Label layout, 12px gap
- Section dividers with `body-sm` uppercase labels

## Layout

### Page Structure
```
+-------+---------------------------+
| Side  | Header (64px)             |
| bar   +---------------------------+
| (256  | Page Content              |
|  px)  |   - Page title + actions  |
|       |   - Content area          |
|       |   - Cards / Tables        |
+-------+---------------------------+
```

### Grid
- Max content width: 1280px
- Card grid: 1/2/3/4 columns responsive
- Gap: 24px (cards), 16px (form fields)

## Animation

- Transitions: 150ms ease-in-out
- Hover effects: opacity, shadow, background-color
- Loading: Skeleton placeholders (gray-200 pulse)
- No unnecessary animations in production

## Tech Stack (Frontend)

- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS 3.x
- **Icons**: `lucide-react`
- **Charts**: Recharts
- **Routing**: React Router v6
- **Hosting**: Cloudflare Pages
