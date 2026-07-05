// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { definePage } from '@objectstack/spec/ui';

/**
 * Start Here — the showcase's teaching index and default landing.
 *
 * A page has TWO orthogonal axes:
 *   • type  — the surface ROLE: home · record · list · app
 *   • kind  — the authoring MODEL: full/slotted · html · react
 *
 * This page teaches the `kind` decision (the capability that keeps iterating) and
 * links to the canonical example of each. It is itself a `kind:'html'` page —
 * constrained JSX composed of registered components + safe HTML, parsed-never-
 * executed (ADR-0080), styled with inline `style` + theme tokens (ADR-0065), no
 * Tailwind. So it doubles as the second HTML-tier example.
 */
export const StartHerePage = definePage({
  name: 'showcase_start_here',
  label: 'Start Here',
  type: 'home',
  kind: 'html',
  isDefault: false,
  source: `
<flex direction="col" gap={8} style={{"maxWidth":"1080px","margin":"0 auto","padding":"40px"}}>

  <flex direction="col" gap={2}>
    <div style={{"fontSize":"12px","fontWeight":"600","letterSpacing":"0.12em","textTransform":"uppercase","color":"hsl(var(--primary))"}}>ObjectStack Showcase</div>
    <div style={{"fontSize":"32px","fontWeight":"700","letterSpacing":"-0.02em","color":"hsl(var(--foreground))"}}>Pick the right page authoring model</div>
    <div style={{"maxWidth":"680px","fontSize":"15px","lineHeight":"1.6","color":"hsl(var(--muted-foreground))"}}>Every page has two axes — its type (the surface role: home · record · list · app) and its kind (how you author it). Choose the simplest kind that expresses what the page needs.</div>
  </flex>

  <flex direction="col" gap={3} style={{"background":"hsl(var(--card))","border":"1px solid hsl(var(--border))","borderRadius":"var(--radius)","padding":"24px"}}>
    <div style={{"fontSize":"16px","fontWeight":"600","color":"hsl(var(--foreground))"}}>Decision tree</div>
    <flex direction="row" gap={3} align="start">
      <div style={{"flexShrink":"0","width":"24px","height":"24px","borderRadius":"9999px","background":"hsl(var(--primary) / 0.15)","color":"hsl(var(--primary))","fontSize":"13px","fontWeight":"700","textAlign":"center","lineHeight":"24px"}}>1</div>
      <div style={{"fontSize":"14px","lineHeight":"1.6","color":"hsl(var(--muted-foreground))"}}>Is it a standard record / list / home you can compose from the component catalogue? → use full / slotted (declarative regions, no code).</div>
    </flex>
    <flex direction="row" gap={3} align="start">
      <div style={{"flexShrink":"0","width":"24px","height":"24px","borderRadius":"9999px","background":"hsl(var(--primary) / 0.15)","color":"hsl(var(--primary))","fontSize":"13px","fontWeight":"700","textAlign":"center","lineHeight":"24px"}}>2</div>
      <div style={{"fontSize":"14px","lineHeight":"1.6","color":"hsl(var(--muted-foreground))"}}>Need free-form custom layout, but no interactivity? → use html (constrained JSX, parsed-never-executed, safe).</div>
    </flex>
    <flex direction="row" gap={3} align="start">
      <div style={{"flexShrink":"0","width":"24px","height":"24px","borderRadius":"9999px","background":"hsl(var(--primary) / 0.15)","color":"hsl(var(--primary))","fontSize":"13px","fontWeight":"700","textAlign":"center","lineHeight":"24px"}}>3</div>
      <div style={{"fontSize":"14px","lineHeight":"1.6","color":"hsl(var(--muted-foreground))"}}>Need real interactivity — cross-component state, master/detail, drawers, live filters? → use react (real React, executed; trusted tier).</div>
    </flex>
  </flex>

  <div style={{"display":"grid","gridTemplateColumns":"repeat(2, 1fr)","gap":"20px"}}>

    <a href="apps/com.example.showcase/page/showcase_component_gallery" style={{"textDecoration":"none","display":"flex","flexDirection":"column","gap":"8px","background":"hsl(var(--card))","border":"1px solid hsl(var(--border))","borderRadius":"var(--radius)","padding":"24px"}}>
      <div style={{"fontSize":"12px","fontWeight":"700","letterSpacing":"0.06em","textTransform":"uppercase","color":"hsl(var(--primary))"}}>full / slotted</div>
      <div style={{"fontSize":"18px","fontWeight":"600","color":"hsl(var(--foreground))"}}>Structured regions</div>
      <div style={{"fontSize":"14px","lineHeight":"1.6","color":"hsl(var(--muted-foreground))"}}>Compose catalogue components into named regions/slots. No code. The default for record, list, and home layouts.</div>
      <div style={{"marginTop":"4px","fontSize":"13px","fontWeight":"600","color":"hsl(var(--primary))"}}>→ Component Gallery</div>
    </a>

    <a href="apps/com.example.showcase/page/showcase_styling_gallery" style={{"textDecoration":"none","display":"flex","flexDirection":"column","gap":"8px","background":"hsl(var(--card))","border":"1px solid hsl(var(--border))","borderRadius":"var(--radius)","padding":"24px"}}>
      <div style={{"fontSize":"12px","fontWeight":"700","letterSpacing":"0.06em","textTransform":"uppercase","color":"hsl(var(--primary))"}}>styling</div>
      <div style={{"fontSize":"18px","fontWeight":"600","color":"hsl(var(--foreground))"}}>Scoped style-objects (ADR-0065)</div>
      <div style={{"fontSize":"14px","lineHeight":"1.6","color":"hsl(var(--muted-foreground))"}}>Style any block with a per-breakpoint style object compiled to scoped CSS — never Tailwind classes in metadata.</div>
      <div style={{"marginTop":"4px","fontSize":"13px","fontWeight":"600","color":"hsl(var(--primary))"}}>→ Styling Gallery</div>
    </a>

    <a href="apps/com.example.showcase/page/showcase_command_center_jsx" style={{"textDecoration":"none","display":"flex","flexDirection":"column","gap":"8px","background":"hsl(var(--card))","border":"1px solid hsl(var(--border))","borderRadius":"var(--radius)","padding":"24px"}}>
      <div style={{"fontSize":"12px","fontWeight":"700","letterSpacing":"0.06em","textTransform":"uppercase","color":"hsl(var(--primary))"}}>html</div>
      <div style={{"fontSize":"18px","fontWeight":"600","color":"hsl(var(--foreground))"}}>Composed, no JS</div>
      <div style={{"fontSize":"14px","lineHeight":"1.6","color":"hsl(var(--muted-foreground))"}}>Free-form layout as constrained JSX text — registered components + safe HTML, parsed-never-executed. Safe, OSS default.</div>
      <div style={{"marginTop":"4px","fontSize":"13px","fontWeight":"600","color":"hsl(var(--primary))"}}>→ Command Center (HTML)</div>
    </a>

    <a href="apps/com.example.showcase/page/showcase_crm_workbench" style={{"textDecoration":"none","display":"flex","flexDirection":"column","gap":"8px","background":"hsl(var(--card))","border":"1px solid hsl(var(--border))","borderRadius":"var(--radius)","padding":"24px"}}>
      <div style={{"fontSize":"12px","fontWeight":"700","letterSpacing":"0.06em","textTransform":"uppercase","color":"hsl(var(--primary))"}}>react</div>
      <div style={{"fontSize":"18px","fontWeight":"600","color":"hsl(var(--foreground))"}}>Interactive (executed)</div>
      <div style={{"fontSize":"14px","lineHeight":"1.6","color":"hsl(var(--muted-foreground))"}}>Real React — hooks, handlers, live useAdapter queries — composing the platform's data blocks into stateful business UIs.</div>
      <div style={{"marginTop":"4px","fontSize":"13px","fontWeight":"600","color":"hsl(var(--primary))"}}>→ CRM Workbench</div>
    </a>

  </div>
</flex>`,
});
