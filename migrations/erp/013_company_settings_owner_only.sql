DELETE FROM module_grants g
USING memberships m, roles r
WHERE g.membership_id = m.id
  AND m.role_id = r.id
  AND r.code = 'platform-admin'
  AND g.module_name = 'settings';
