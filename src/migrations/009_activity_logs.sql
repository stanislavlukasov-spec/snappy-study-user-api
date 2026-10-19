-- Activity log: records every action a child takes in the app.
-- Starting with image_analysis - new activity types (quiz_result etc.)
-- are added simply by inserting a different type value.

CREATE TABLE IF NOT EXISTS activity_logs (
  id         VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  child_id   VARCHAR(36)  NOT NULL,
  parent_id  VARCHAR(36)  NOT NULL,
  type       VARCHAR(50)  NOT NULL,
  metadata   JSON         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),

  INDEX idx_child_recent (child_id, created_at DESC),

  CONSTRAINT fk_activity_child
    FOREIGN KEY (child_id)  REFERENCES children(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_parent
    FOREIGN KEY (parent_id) REFERENCES parents(id)  ON DELETE CASCADE
);
