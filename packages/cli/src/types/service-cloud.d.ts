// Ambient stub for `@objectstack/service-cloud`.
//
// `service-cloud` ships from the private `objectstack-ai/cloud` repo and is
// NOT in this open-core workspace. The CLI's `serve --mode=cloud` boot path
// dynamically `import()`s it inside a try/catch — when absent we surface a
// clear "install the cloud-aware distribution" hint to the user.
//
// This declaration keeps the optional path typechecking. `any` is intentional
// (the CLI only consumes the runtime factory; full types live in the cloud
// repo).
declare module '@objectstack/service-cloud' {
  export function createBootStack(config?: any): Promise<any>;
}
