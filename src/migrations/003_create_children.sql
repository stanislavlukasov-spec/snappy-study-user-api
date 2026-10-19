CREATE TABLE IF NOT EXISTS children (
  id           VARCHAR(36)  NOT NULL,
  parent_id    VARCHAR(36)  NOT NULL,
  display_name VARCHAR(64)  NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_children_parent_id (parent_id),
  CONSTRAINT fk_children_parent FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
