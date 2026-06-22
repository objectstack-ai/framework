// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Styling Gallery (ADR-0065) — the canonical example of the SDUI scoped-styling
 * model. A pricing page composed from generic blocks (`flex` / `element:text` /
 * `element:button`) that each carry a `responsiveStyles` object (per-breakpoint
 * CSS-property maps) with **design-token values** (`var(--space-*)`,
 * `var(--surface)`, `var(--brand)`, `hsl(var(--primary))`, …) — NO `className`.
 *
 * objectui's `SchemaRenderer` compiles each node's `responsiveStyles` to
 * **id-scoped CSS** injected as an unlayered `<style>` at render: build-independent
 * (arbitrary values + tokens pass through verbatim), collision-free (per-node
 * scope beats base utilities without `@layer` games), responsive-correct
 * (breakpoint maps → generated `@media`, never `md:` classes). This is the
 * preferred way to style a metadata-authored page; see the objectstack-ui skill
 * "Styling (ADR-0065)" section.
 *
 * Note: child nodes go in `properties.children` (the renderer hoists `properties`
 * to schema level at render); `responsiveStyles`/`id` are top-level envelope fields.
 */

/** One checklist line: an accent-coloured check + the label. */
function feature(label: string): any {
  return {
    id: `feat_${label}`,
    type: 'flex',
    responsiveStyles: { large: { display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' } },
    properties: {
      children: [
        { id: `feat_${label}_chk`, type: 'element:text', responsiveStyles: { large: { color: 'hsl(var(--primary))', fontWeight: '700', lineHeight: '1.5' } }, properties: { content: '✓' } },
        { id: `feat_${label}_lbl`, type: 'element:text', responsiveStyles: { large: { fontSize: '14px', color: 'var(--text-strong)', lineHeight: '1.5' } }, properties: { content: label } },
      ],
    },
  };
}

/** A plan column — a styled `flex` box (no opinionated page:card). */
function planCard(o: { name: string; price: string; period: string; tagline: string; features: string[]; cta: string; popular?: boolean }): any {
  return {
    id: `plan_${o.name}`,
    type: 'flex',
    responsiveStyles: {
      large: {
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
        padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--surface)',
        border: o.popular ? '1px solid hsl(var(--primary))' : '1px solid var(--hairline)',
        boxShadow: o.popular ? '0 0 0 3px hsl(var(--primary) / 0.25), var(--shadow-lg)' : 'var(--shadow-sm)',
      },
      small: { padding: 'var(--space-4)', gap: 'var(--space-3)' },
    },
    properties: {
      children: [
        ...(o.popular
          ? [{ id: `plan_${o.name}_badge`, type: 'element:text', responsiveStyles: { large: { alignSelf: 'flex-start', fontSize: '12px', fontWeight: '600', color: 'var(--brand-foreground)', backgroundColor: 'var(--brand)', padding: '2px 10px', borderRadius: '999px' } }, properties: { content: 'Most popular' } }]
          : []),
        { id: `plan_${o.name}_name`, type: 'element:text', responsiveStyles: { large: { fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' } }, properties: { content: o.name } },
        {
          id: `plan_${o.name}_price_row`, type: 'flex',
          responsiveStyles: { large: { display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' } },
          properties: {
            children: [
              { id: `plan_${o.name}_price`, type: 'element:text', responsiveStyles: { large: { fontSize: '40px', fontWeight: '700', color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }, small: { fontSize: '32px' } }, properties: { content: o.price } },
              { id: `plan_${o.name}_period`, type: 'element:text', responsiveStyles: { large: { fontSize: '13px', color: 'var(--text-muted)' } }, properties: { content: o.period } },
            ],
          },
        },
        { id: `plan_${o.name}_tagline`, type: 'element:text', responsiveStyles: { large: { fontSize: '13px', color: 'var(--text-muted)', minHeight: '34px' } }, properties: { content: o.tagline } },
        { id: `plan_${o.name}_divider`, type: 'flex', responsiveStyles: { large: { height: '1px', backgroundColor: 'var(--hairline)', margin: 'var(--space-1) 0' } }, properties: { children: [] } },
        ...o.features.map(feature),
        { id: `cta_${o.name}`, type: 'element:button', responsiveStyles: { large: { marginTop: 'auto', width: '100%' } }, properties: { label: o.cta, variant: o.popular ? 'primary' : 'secondary', size: 'large' } },
      ],
    },
  };
}

export const StylingGalleryPage = definePage({
  name: 'showcase_styling_gallery',
  label: 'Styling (ADR-0065)',
  type: 'app',
  template: 'default',
  kind: 'full',
  isDefault: false,
  regions: [
    {
      name: 'main',
      width: 'full',
      components: [
        {
          id: 'styling_root',
          type: 'flex',
          responsiveStyles: {
            large: { minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-8)', padding: 'var(--space-12) var(--space-6)' },
            small: { padding: 'var(--space-8) var(--space-4)' },
          },
          properties: {
            children: [
              {
                id: 'styling_header', type: 'flex',
                responsiveStyles: { large: { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', textAlign: 'center', maxWidth: '42rem' } },
                properties: {
                  children: [
                    { id: 'styling_title', type: 'element:text', responsiveStyles: { large: { fontSize: '40px', fontWeight: '700', letterSpacing: '-0.02em', color: 'var(--text-strong)' }, small: { fontSize: '30px' } }, properties: { content: 'Plans & Pricing' } },
                    { id: 'styling_subtitle', type: 'element:text', responsiveStyles: { large: { fontSize: '16px', color: 'var(--text-muted)' } }, properties: { content: 'Styled entirely with responsiveStyles + design tokens — zero Tailwind class strings (ADR-0065).' } },
                  ],
                },
              },
              {
                id: 'plan_grid', type: 'flex',
                responsiveStyles: {
                  large: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 'var(--space-6)', width: '100%', maxWidth: '80rem', alignItems: 'stretch', marginTop: 'var(--space-4)' },
                  medium: { gridTemplateColumns: 'repeat(2, minmax(0,1fr))' },
                  small: { gridTemplateColumns: '1fr' },
                },
                properties: {
                  children: [
                    planCard({ name: 'Free', price: '$0', period: 'forever', tagline: 'For evaluating and small personal projects.', features: ['1 environment', '3 users', 'AI online development', '7-day audit retention'], cta: 'Get started' }),
                    planCard({ name: 'Solo', price: '$29', period: 'per month', tagline: 'For solo builders and indie makers.', features: ['2 environments', '10 users', 'Custom domains', 'Stronger AI model', '30-day audit retention'], cta: 'Upgrade to Solo', popular: true }),
                    planCard({ name: 'Team', price: '$99', period: 'per month', tagline: 'For teams shipping real apps.', features: ['2 environments', '100 users', 'Custom domains', '30-day audit retention'], cta: 'Upgrade to Team' }),
                    planCard({ name: 'Business', price: '$299', period: 'per month', tagline: 'For organizations that need SSO and scale.', features: ['4 environments', '500 users', 'SSO / SAML', '1-year audit retention'], cta: 'Upgrade to Business' }),
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  ],
});
