CREATE VIRTUAL TABLE users_search USING fts5(
  id UNINDEXED,
  name,
  display_name,
  github_id
);

INSERT INTO users_search(id, name, display_name, github_id)
SELECT id, name, display_name, github_id FROM users;

CREATE TRIGGER users_search_ai AFTER INSERT ON users BEGIN
  INSERT INTO users_search(id, name, display_name, github_id)
  VALUES (new.id, new.name, new.display_name, new.github_id);
END;

CREATE TRIGGER users_search_ad AFTER DELETE ON users BEGIN
  DELETE FROM users_search WHERE rowid = (SELECT rowid FROM users_search WHERE id = old.id);
END;

CREATE TRIGGER users_search_au AFTER UPDATE ON users BEGIN
  UPDATE users_search
  SET name = new.name, display_name = new.display_name, github_id = new.github_id
  WHERE rowid = (SELECT rowid FROM users_search WHERE id = new.id);
END;
