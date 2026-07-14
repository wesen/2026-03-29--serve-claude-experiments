// Package userdata is a SQLite-backed store for per-user organization of
// artifacts: favorites, user-applied tags, and ordered collections (playlists).
//
// The schema is multi-user from the start — every user-owned row carries a
// user_id — but there is no identity provider yet, so callers pass a single
// hardcoded user id (see server.DefaultUserID). Going multi-user later is a
// change to how the acting user is resolved, not a schema migration.
//
// Artifacts are referenced by their stable Name (the slash path relative to the
// serve root without extension), the same key the HTTP routes use, so user data
// joins to artifacts without an artifacts table.
package userdata

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// Store wraps a SQLite database holding per-user artifact organization.
type Store struct {
	db *sql.DB
}

// Collection is a named, ordered set of artifacts owned by a user.
type Collection struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Count int    `json:"count"`
}

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  display_name TEXT,
  created_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id      TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, artifact_key)
);
CREATE TABLE IF NOT EXISTS artifact_tags (
  user_id      TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  tag          TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, artifact_key, tag)
);
CREATE TABLE IF NOT EXISTS collections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, name)
);
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id INTEGER NOT NULL,
  artifact_key  TEXT NOT NULL,
  position      INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (collection_id, artifact_key),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);
`

// Open opens (creating if needed) the SQLite database at path, enables foreign
// keys, applies the schema, and seeds the default user.
func Open(path string) (*Store, error) {
	// _foreign_keys=on makes ON DELETE CASCADE fire; _busy_timeout avoids
	// "database is locked" under brief write contention.
	dsn := fmt.Sprintf("file:%s?_foreign_keys=on&_busy_timeout=5000", path)
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if _, err := db.Exec(schema); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	s := &Store{db: db}
	return s, nil
}

// Close closes the underlying database.
func (s *Store) Close() error { return s.db.Close() }

func now() string { return time.Now().UTC().Format(time.RFC3339) }

// EnsureUser inserts the user if absent (idempotent).
func (s *Store) EnsureUser(id, displayName string) error {
	_, err := s.db.Exec(
		`INSERT OR IGNORE INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
		id, displayName, now())
	return err
}

// ---- favorites ----------------------------------------------------------

// SetFavorite marks (on) or unmarks (off) an artifact as a favorite.
func (s *Store) SetFavorite(user, key string, on bool) error {
	if on {
		_, err := s.db.Exec(
			`INSERT OR IGNORE INTO favorites (user_id, artifact_key, created_at) VALUES (?, ?, ?)`,
			user, key, now())
		return err
	}
	_, err := s.db.Exec(`DELETE FROM favorites WHERE user_id = ? AND artifact_key = ?`, user, key)
	return err
}

// IsFavorite reports whether the artifact is a favorite of the user.
func (s *Store) IsFavorite(user, key string) (bool, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM favorites WHERE user_id = ? AND artifact_key = ?`, user, key).Scan(&n)
	return n > 0, err
}

// Favorites returns the set of favorited artifact keys for the user.
func (s *Store) Favorites(user string) (map[string]bool, error) {
	rows, err := s.db.Query(`SELECT artifact_key FROM favorites WHERE user_id = ?`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		out[k] = true
	}
	return out, rows.Err()
}

// ---- tags ---------------------------------------------------------------

// AddTag applies a user tag to an artifact (idempotent).
func (s *Store) AddTag(user, key, tag string) error {
	_, err := s.db.Exec(
		`INSERT OR IGNORE INTO artifact_tags (user_id, artifact_key, tag, created_at) VALUES (?, ?, ?, ?)`,
		user, key, tag, now())
	return err
}

// RemoveTag removes a user tag from an artifact.
func (s *Store) RemoveTag(user, key, tag string) error {
	_, err := s.db.Exec(`DELETE FROM artifact_tags WHERE user_id = ? AND artifact_key = ? AND tag = ?`, user, key, tag)
	return err
}

// TagsFor returns the user's tags for a single artifact, ordered.
func (s *Store) TagsFor(user, key string) ([]string, error) {
	rows, err := s.db.Query(`SELECT tag FROM artifact_tags WHERE user_id = ? AND artifact_key = ? ORDER BY tag`, user, key)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// TagsByArtifact returns all of the user's tags grouped by artifact key.
func (s *Store) TagsByArtifact(user string) (map[string][]string, error) {
	rows, err := s.db.Query(`SELECT artifact_key, tag FROM artifact_tags WHERE user_id = ? ORDER BY artifact_key, tag`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string][]string{}
	for rows.Next() {
		var k, t string
		if err := rows.Scan(&k, &t); err != nil {
			return nil, err
		}
		out[k] = append(out[k], t)
	}
	return out, rows.Err()
}

// AllTags returns the distinct set of tags the user has applied, ordered.
func (s *Store) AllTags(user string) ([]string, error) {
	rows, err := s.db.Query(`SELECT DISTINCT tag FROM artifact_tags WHERE user_id = ? ORDER BY tag`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// ---- collections --------------------------------------------------------

// CreateCollection creates a named collection and returns its id.
func (s *Store) CreateCollection(user, name string) (int64, error) {
	res, err := s.db.Exec(`INSERT INTO collections (user_id, name, created_at) VALUES (?, ?, ?)`, user, name, now())
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// ListCollections returns the user's collections with item counts.
func (s *Store) ListCollections(user string) ([]Collection, error) {
	rows, err := s.db.Query(`
		SELECT c.id, c.name, COUNT(ci.artifact_key)
		FROM collections c
		LEFT JOIN collection_items ci ON ci.collection_id = c.id
		WHERE c.user_id = ?
		GROUP BY c.id, c.name
		ORDER BY c.name`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Collection
	for rows.Next() {
		var c Collection
		if err := rows.Scan(&c.ID, &c.Name, &c.Count); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// owns reports whether the collection belongs to the user.
func (s *Store) owns(user string, id int64) (bool, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM collections WHERE id = ? AND user_id = ?`, id, user).Scan(&n)
	return n > 0, err
}

// DeleteCollection removes a collection (and, via cascade, its items).
func (s *Store) DeleteCollection(user string, id int64) error {
	_, err := s.db.Exec(`DELETE FROM collections WHERE id = ? AND user_id = ?`, id, user)
	return err
}

// AddToCollection appends an artifact to a collection (idempotent), at the end.
func (s *Store) AddToCollection(user string, id int64, key string) error {
	ok, err := s.owns(user, id)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("collection %d not found for user", id)
	}
	var maxPos sql.NullInt64
	if err := s.db.QueryRow(`SELECT MAX(position) FROM collection_items WHERE collection_id = ?`, id).Scan(&maxPos); err != nil {
		return err
	}
	_, err = s.db.Exec(
		`INSERT OR IGNORE INTO collection_items (collection_id, artifact_key, position, created_at) VALUES (?, ?, ?, ?)`,
		id, key, maxPos.Int64+1, now())
	return err
}

// RemoveFromCollection removes an artifact from a collection.
func (s *Store) RemoveFromCollection(user string, id int64, key string) error {
	ok, err := s.owns(user, id)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("collection %d not found for user", id)
	}
	_, err = s.db.Exec(`DELETE FROM collection_items WHERE collection_id = ? AND artifact_key = ?`, id, key)
	return err
}

// ReorderCollection sets the order of a collection's items to the given keys.
func (s *Store) ReorderCollection(user string, id int64, keys []string) error {
	ok, err := s.owns(user, id)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("collection %d not found for user", id)
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	for i, key := range keys {
		if _, err := tx.Exec(`UPDATE collection_items SET position = ? WHERE collection_id = ? AND artifact_key = ?`, i, id, key); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// CollectionItems returns the ordered artifact keys in a collection.
func (s *Store) CollectionItems(user string, id int64) ([]string, error) {
	ok, err := s.owns(user, id)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("collection %d not found for user", id)
	}
	rows, err := s.db.Query(`SELECT artifact_key FROM collection_items WHERE collection_id = ? ORDER BY position`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}
