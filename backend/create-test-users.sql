-- 如果知道旧的userId，可以创建相同ID的用户（需要提供旧userId）
-- 示例：
-- INSERT INTO "User" (id, "passwordHash", name, phone, "userType", "userRole", "createdAt", "updatedAt")
-- VALUES ('旧的userId', '$2a$10$hash...', '测试用户', '手机号', 'CUSTOMER', 'USER', NOW(), NOW());

-- 超级管理员 (手机号: 15060850289, 密码: wh123456)
INSERT INTO "User" (id, "passwordHash", name, phone, "userType", "userRole", "createdAt", "updatedAt")
VALUES (
  '3fdd3d80-2aef-4075-bd22-808a0f9aa4d6',
  '$2a$10$6cXWhpyI6FCMNUEjKD.SJOKqz4qqJFU0/fuWNnLTnA7L8YFTvDKzC',
  '超级管理员',
  '15060850289',
  'EMPLOYEE',
  'ADMIN',
  NOW(),
  NOW()
) ON CONFLICT (phone) DO NOTHING;
