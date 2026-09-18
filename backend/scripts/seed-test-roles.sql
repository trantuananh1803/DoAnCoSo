UPDATE users SET role = 'admin' WHERE email = 'admin@test.com';
UPDATE users SET role = 'staff' WHERE email = 'staff@test.com';
SELECT email, role FROM users;