// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineSeed } from '@objectstack/spec/data';
import { cel } from '@objectstack/spec';
import { Task } from '../objects/task.object';

const tasks = defineSeed(Task, {
  mode: 'upsert',
  externalId: 'subject',
  records: [
    { subject: 'Learn ObjectStack',           status: 'completed',   priority: 'high',   category: 'work',     owner: 'admin' },
    { subject: 'Build a cool app',            status: 'in_progress', priority: 'normal', category: 'work',     owner: 'admin', due_date: cel`daysFromNow(3)` },
    { subject: 'Review PR #102',              status: 'completed',   priority: 'high',   category: 'work',     owner: 'admin' },
    { subject: 'Write Documentation',         status: 'not_started', priority: 'normal', category: 'work',     owner: 'admin', due_date: cel`daysFromNow(1)` },
    { subject: 'Fix Server bug',              status: 'waiting',     priority: 'urgent', category: 'work',     owner: 'admin' },
    { subject: 'Buy groceries',               status: 'not_started', priority: 'low',    category: 'shopping', owner: 'admin', due_date: cel`today()` },
    { subject: 'Schedule dentist appointment',status: 'not_started', priority: 'normal', category: 'health',   owner: 'admin', due_date: cel`daysFromNow(7)` },
    { subject: 'Pay utility bills',           status: 'not_started', priority: 'high',   category: 'finance',  owner: 'admin', due_date: cel`daysFromNow(2)` },
  ],
});

export const TodoSeedData = [tasks];
