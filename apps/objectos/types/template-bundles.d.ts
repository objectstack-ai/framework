// Ambient declaration for example-app template bundles statically imported
// by `server/templates/*.ts`. Those paths live outside this package's
// `include` scope so TS cannot discover their types; we accept `any` here
// and rely on the `StackBundle` shape returned by the seeder at runtime.
declare module '*/objectstack.config' {
    const bundle: any;
    export default bundle;
}
