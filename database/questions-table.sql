-- ============================================================
-- 題目管理表：後台可編輯，前台動態載入
-- 只有一筆記錄（id='main'），存整份 DATA JSON
-- ============================================================

CREATE TABLE IF NOT EXISTS questions (
  id          TEXT        PRIMARY KEY DEFAULT 'main',
  data        JSONB       NOT NULL,
  version     INTEGER     NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  updated_by  TEXT
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- 前台 anon 可讀（學員端動態載入題目用）
CREATE POLICY "anon_read_questions" ON questions
  FOR SELECT TO anon USING (true);

-- 登入用戶（owner）可寫
CREATE POLICY "auth_write_questions" ON questions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
