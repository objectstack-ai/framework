---
'@objectstack/platform-objects': patch
---

`sys_user` account-management actions (Ban/Unban, Unlock Account, Set Password, Set Platform Role, Impersonate) now also surface on the user record-detail header (`record_header`, overflowing into the ⋯ "More" menu), not just the Users list row menu — so a platform admin can manage an account from an open user record without navigating back to the list.
