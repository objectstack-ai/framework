// Stub ambient declaration for the @objectstack/service-cloud package.
// The package's tsup build cannot emit .d.ts yet (pre-existing typecheck
// errors in upstream dependencies). The CLI only consumes the runtime
// `createBootStack()` factory, so a loose `any` type suffices.
declare module '@objectstack/service-cloud' {
  export function createBootStack(config?: any): Promise<any>;
}
