-- Add night shift (23:00-07:00) for call center
INSERT INTO call_center_shifts (department_id, name, start_time, end_time)
SELECT id, 'לילה', '23:00', '07:00'
FROM departments 
WHERE name = 'מוקד 106'
ON CONFLICT DO NOTHING
RETURNING id, name, start_time, end_time;
