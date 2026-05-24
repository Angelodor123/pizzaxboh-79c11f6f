
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS completed_tutorial_steps text[] NOT NULL DEFAULT '{}';

-- Backward compatibility: users who already finished tutorial v2+ are marked
-- as having seen the current active steps so they aren't re-prompted.
UPDATE public.profiles
SET completed_tutorial_steps = ARRAY[
  'step_shift_checklist_v2',
  'step_dough_status_v2',
  'step_notepad_sync_v2'
]
WHERE tutorial_version >= 2
  AND NOT (completed_tutorial_steps @> ARRAY[
    'step_shift_checklist_v2',
    'step_dough_status_v2',
    'step_notepad_sync_v2'
  ]);
