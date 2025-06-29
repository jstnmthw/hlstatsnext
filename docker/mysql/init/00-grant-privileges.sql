-- The Docker entrypoint script for MySQL automatically creates the user defined by
-- the MYSQL_USER environment variable. We do not need to create it again.
--
-- This script's sole purpose is to elevate the privileges of that pre-existing user
-- to grant it the ability to create and drop the shadow databases required by Prisma.
-- Granting ALL PRIVILEGES is acceptable for a local, isolated development database.

-- The username is hardcoded to 'hlstatsnext' to match the default in docker-compose.yml.
-- The '%' host allows the user to connect from any container on the Docker network.
GRANT ALL PRIVILEGES ON *.* TO 'hlstatsnext'@'%';

-- Apply the privilege changes immediately.
FLUSH PRIVILEGES; 