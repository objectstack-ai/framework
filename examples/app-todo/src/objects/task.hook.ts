// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { HookContext, Hook } from '@objectstack/spec/data';

const taskHook: Hook = {
  name: 'task_logic',
  object: 'todo_task',
  events: ['beforeInsert', 'afterUpdate'],
  handler: async (ctx: HookContext) => {
    if (ctx.event === 'beforeInsert') {
      const { input } = ctx;
      // Default priority
      if (!input.priority) {
        input.priority = 'normal';
      }
      // Default status
      if (!input.status) {
        input.status = 'not_started';
      }
      // Validation
      if (typeof input.subject === 'string' && input.subject.includes('spam')) {
        throw new Error('Spam tasks are not allowed');
      }
    }
    
    if (ctx.event === 'afterUpdate') {
      // Check if completed
      if (ctx.input.status === 'completed' && ctx.previous && ctx.previous.status !== 'completed') {
        console.log(`Task ${ctx.id} completed by ${ctx.session?.userId || 'unknown'}`);
        // Could trigger notifications or integrations here
      }
      
      // Check if task became overdue
      if (ctx.input.is_overdue && ctx.previous && !ctx.previous.is_overdue) {
        console.log(`Task ${ctx.id} is now overdue`);
      }
    }
  }
};

export default taskHook;
