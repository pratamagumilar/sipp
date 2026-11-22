INSERT INTO "InstallationType" ("code", "name") VALUES
  ('IPTL TM', 'IPTL TM'), ('PLTD', 'PLTD'), ('PLTS', 'PLTS'),
  ('PLTMH', 'PLTMH'), ('DISTEM', 'DISTEM'), ('DISTER', 'DISTER')
ON CONFLICT ("code") DO NOTHING;
