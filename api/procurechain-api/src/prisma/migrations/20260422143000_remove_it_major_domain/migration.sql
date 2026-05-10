UPDATE "Subcategory"
SET
  "level1" = 'Goods & Materials',
  "level2" = 'IT Software Products'
WHERE "id" IN ('IT-SW-LIC-001', 'IT-SW-SUB-001');

UPDATE "Subcategory"
SET
  "level1" = 'Goods & Materials',
  "level2" = 'IT Hardware - Input & Output'
WHERE "id" IN ('IT-HW-END-001', 'IT-HW-PER-001');

UPDATE "Subcategory"
SET
  "level1" = 'Goods & Materials',
  "level2" = 'IT Hardware - Input & Output'
WHERE "isCustom" = true
  AND "level1" = 'IT'
  AND "level2" = 'Hardware';

UPDATE "Subcategory"
SET
  "level1" = 'Goods & Materials',
  "level2" = 'IT Software Products'
WHERE "isCustom" = true
  AND "level1" = 'IT'
  AND "level2" = 'Software';
