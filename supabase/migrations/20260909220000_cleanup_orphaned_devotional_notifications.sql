-- Real, live-reproduced bug: deleteDevotional() and the unpublish path
-- in setDevotionalStatus()/updateDevotional() never cleaned up the
-- "devotional_published" notification rows they had created — so
-- clicking an old notification (in-app bell, or a push notification
-- tapped later) for a devotional that was since deleted or unpublished
-- correctly 404s at /devocionales/<id>, since that page genuinely can't
-- find it. The 404 page itself isn't the bug; the stale notification
-- pointing at dead content is. Several real users' accounts (confirmed
-- via their notification history, including one already-read by a real
-- admin account) currently hold exactly this stale state — this is a
-- one-time repair of that; the code fix (removeDevotionalNotifications,
-- called from deleteDevotional/unpublish going forward) prevents it from
-- recurring.
delete from public.notifications n
where n.type = 'devotional_published'
  and not exists (
    select 1 from public.devotionals d
    where d.id = n.resource_id
      and d.status = 'published'
  );
