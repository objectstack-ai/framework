// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.


import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { SchemaRegistry, ObjectQL, ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';

import TodoApp from '@example/app-todo/objectstack.config';

(async () => {
    console.log('--- Debug Registry ---');
    console.log('Apps:', [TodoApp.name]);
    console.log('Objects inside App:', TodoApp.objects?.map((o: any) => o.name));

    const kernel = new ObjectKernel();
    
    kernel
        .use(new ObjectQLPlugin())
        .use(new DriverPlugin(new InMemoryDriver(), 'memory'))
        .use(new AppPlugin(TodoApp));
    
    await kernel.bootstrap();
    
    console.log('--- Post Start ---');
    
    // Check Registry directly
    const obj = SchemaRegistry.getObject('todo_task');
    console.log('Registry "todo_task":', obj ? 'FOUND' : 'MISSING');
    
    // Check Registry via Engine
    try {
        // Access private engine map if possible or simulate query
        // The engine doesn't expose a 'hasObject' method easily, but we can inspect internal logic
        // Actually SchemaRegistry is static, so if it's there, it's there.
    } catch (e) {
        console.error(e);
    }
})();
