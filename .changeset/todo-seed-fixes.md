---
---

chore(todo): fix two app-todo defects found driving it end-to-end — (1) `todo_task.owner` was a lookup to `user`, which isn't a registered object, so seed/owner resolution hit "no such table: user" (the platform user object is `sys_user`); (2) the two `completed` seed tasks omitted `completed_date`, violating the object's own `completed_date_required` validation, so they silently failed to seed (6 of 8 rows loaded). Repointed the lookup to `sys_user`, dropped the unresolvable `owner: 'admin'` seed value, and gave completed seeds a `completed_date`. Now all 8 rows seed; validation still rejects a completed task with no date. Example-app only.
