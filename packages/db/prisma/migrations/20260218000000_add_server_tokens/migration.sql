-- Create server_tokens table for token-based authentication
CREATE TABLE `server_tokens` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token_hash`    VARCHAR(64)  NOT NULL,
  `token_prefix`  VARCHAR(12)  NOT NULL,
  `name`          VARCHAR(128) NOT NULL,
  `rcon_password` VARCHAR(512) NOT NULL DEFAULT '',
  `game`          VARCHAR(32)  NOT NULL DEFAULT 'valve',
  `created_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at`    DATETIME(3)  NULL,
  `revoked_at`    DATETIME(3)  NULL,
  `last_used_at`  DATETIME(3)  NULL,
  `created_by`    VARCHAR(16)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `server_tokens_token_hash_key` (`token_hash`),
  KEY `idx_token_revoked` (`revoked_at`),
  KEY `idx_token_last_used` (`last_used_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add token_id FK to servers table
ALTER TABLE `servers`
  ADD COLUMN `token_id` INT UNSIGNED NULL,
  ADD KEY `idx_server_token` (`token_id`),
  ADD CONSTRAINT `servers_token_id_fkey`
    FOREIGN KEY (`token_id`) REFERENCES `server_tokens` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
