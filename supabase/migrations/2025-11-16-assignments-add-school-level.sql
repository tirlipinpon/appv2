alter table teacher_assignments
  add column if not exists school_level text null;

create index if not exists idx_teacher_assignments_school_level
  on teacher_assignments (school_id, school_level);


