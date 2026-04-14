// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// import { ObjectKernel, DriverPlugin, AppPlugin, createApiRegistryPlugin } from '@objectstack/runtime';
// import { InMemoryDriver } from '@objectstack/driver-memory';
// import { ObjectQLPlugin } from '@objectstack/objectql';
// import { HonoServerPlugin } from '@objectstack/plugin-hono-server';
// import { MetadataPlugin } from '@objectstack/metadata';
// import path from 'path';

// import CrmApp from '@example/app-crm/objectstack.config';
// import TodoApp from '@example/app-todo/objectstack.config';
// import BiPluginManifest from '@example/plugin-bi/objectstack.config';

// (async () => {
//   console.log('🚀 Booting Kernel...');

//   // Use MiniKernel architecture
//   const kernel = new ObjectKernel();
  
//   // Register Metadata Plugin (File System Loader)
//   // Best Practice: Load metadata early so it's available for other plugins
//   await kernel.use(new MetadataPlugin({ rootDir: path.resolve(__dirname, '../metadata') }));

//   // Register ObjectQL engine
//   await kernel.use(new ObjectQLPlugin());

//   // Database driver
//   await kernel.use(new DriverPlugin(new InMemoryDriver(), 'memory'));

//   // App manifests
//   await kernel.use(new AppPlugin(CrmApp));
//   await kernel.use(new AppPlugin(TodoApp));
//   await kernel.use(new AppPlugin(BiPluginManifest));

//   // Register API Registry (Required for Hono Server)
//   await kernel.use(createApiRegistryPlugin());

//   // Load the Hono Server Plugin
//   await kernel.use(new HonoServerPlugin({ 
//     port: process.env.PORT ? parseInt(process.env.PORT) : 3004, 
//     staticRoot: './public' 
//   }));

//   await kernel.bootstrap();
// })();
