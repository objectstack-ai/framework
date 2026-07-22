---
"@objectstack/plugin-audit": minor
---

remove(plugin-audit): drop the kernel's built-in assignment notifications; move the policy to user-space automation (#3403)

**Breaking (behavioral).** `plugin-audit` no longer emits a `collab.assignment`
notification when an owner/assignee field changes on a record. Deciding that an
assignment warrants a bell is a business policy, not a platform default — the
kernel version guessed "who is the assignee" from field names (`owner_id`,
`assigned_to`, `assignee_id`, `owner`, `assignee`), which misfired on system
records like `sys_file` and spammed users with "…assigned to you" noise on file
uploads (#3402).

**What was removed:** the `writeAssignmentNotifications` writer, the `OWNER_FIELDS`
heuristic, and the `messages.assignedToYou` translation key (en / zh-CN / ja-JP /
es-ES). **Unaffected:** `sys_audit_log` / `sys_activity` capture, and `@mention`
notifications (`collab.mention`) — those remain platform behavior. The
`owner_of:` messaging audience and `service-messaging`'s `DEFAULT_OWNER_FIELDS`
are a separate, caller-requested mechanism and are unchanged.

**FROM → TO migration.** If you relied on the automatic bell, configure an
automation flow on the target object (`record-after-update` / `record-after-create`
trigger + a `notify` node). The `condition` can read the pre-update row via
`previous`, and `notify`'s `recipients` / `title` / `actionUrl` all interpolate
record fields. Ready-made example: `showcase_task_assigned_notify` in
`examples/app-showcase/src/automation/flows/index.ts`:

```ts
{ id: 'start', type: 'start', config: {
    objectName: 'your_object',
    triggerType: 'record-after-update',
    condition: 'assignee != previous.assignee',
} },
{ id: 'notify_assignee', type: 'notify', config: {
    topic: 'task.assigned',
    recipients: ['{record.assignee}'],
    channels: ['inbox'],
    title: 'New assignment: {record.title}',
    actionUrl: '/your_object/{record.id}',
} },
```

Notes on parity: the flow template renders a single language (the kernel version
localized the title to the recipient's locale); a flow fires on every real change
(the `previous` condition already gates that) and, unless you add an actor guard,
also notifies self-assignments — the kernel version suppressed those.
