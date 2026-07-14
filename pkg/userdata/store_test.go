package userdata

import (
	"path/filepath"
	"testing"
)

func openTest(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	if err := s.EnsureUser("default", "Default"); err != nil {
		t.Fatalf("EnsureUser: %v", err)
	}
	return s
}

func TestFavoritesToggle(t *testing.T) {
	s := openTest(t)
	if err := s.SetFavorite("default", "a/b/Calendar", true); err != nil {
		t.Fatal(err)
	}
	if err := s.SetFavorite("default", "a/b/Calendar", true); err != nil { // idempotent
		t.Fatal(err)
	}
	fav, _ := s.Favorites("default")
	if !fav["a/b/Calendar"] || len(fav) != 1 {
		t.Fatalf("favorites = %v", fav)
	}
	if err := s.SetFavorite("default", "a/b/Calendar", false); err != nil {
		t.Fatal(err)
	}
	if is, _ := s.IsFavorite("default", "a/b/Calendar"); is {
		t.Fatal("should be unfavorited")
	}
}

func TestTags(t *testing.T) {
	s := openTest(t)
	s.AddTag("default", "k1", "chart")
	s.AddTag("default", "k1", "chart") // idempotent
	s.AddTag("default", "k1", "ui")
	s.AddTag("default", "k2", "chart")
	byArt, _ := s.TagsByArtifact("default")
	if len(byArt["k1"]) != 2 || byArt["k2"][0] != "chart" {
		t.Fatalf("tags by artifact = %v", byArt)
	}
	all, _ := s.AllTags("default")
	if len(all) != 2 { // chart, ui (distinct)
		t.Fatalf("all tags = %v", all)
	}
	s.RemoveTag("default", "k1", "chart")
	tf, _ := s.TagsFor("default", "k1")
	if len(tf) != 1 || tf[0] != "ui" {
		t.Fatalf("tags for k1 = %v", tf)
	}
}

func TestCollectionsOrderAndCascade(t *testing.T) {
	s := openTest(t)
	id, err := s.CreateCollection("default", "Best UIs")
	if err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"one", "two", "three"} {
		if err := s.AddToCollection("default", id, k); err != nil {
			t.Fatal(err)
		}
	}
	items, _ := s.CollectionItems("default", id)
	if len(items) != 3 || items[0] != "one" || items[2] != "three" {
		t.Fatalf("items order = %v", items)
	}
	// reorder
	if err := s.ReorderCollection("default", id, []string{"three", "one", "two"}); err != nil {
		t.Fatal(err)
	}
	items, _ = s.CollectionItems("default", id)
	if items[0] != "three" || items[1] != "one" || items[2] != "two" {
		t.Fatalf("reordered = %v", items)
	}
	// list with count
	cols, _ := s.ListCollections("default")
	if len(cols) != 1 || cols[0].Count != 3 || cols[0].Name != "Best UIs" {
		t.Fatalf("list = %+v", cols)
	}
	// delete cascades items (FK ON DELETE CASCADE)
	if err := s.DeleteCollection("default", id); err != nil {
		t.Fatal(err)
	}
	var n int
	s.db.QueryRow(`SELECT COUNT(*) FROM collection_items WHERE collection_id = ?`, id).Scan(&n)
	if n != 0 {
		t.Fatalf("cascade failed: %d orphan items", n)
	}
}

func TestCollectionOwnershipIsolation(t *testing.T) {
	s := openTest(t)
	s.EnsureUser("other", "Other")
	id, _ := s.CreateCollection("default", "mine")
	// another user cannot add to or read it
	if err := s.AddToCollection("other", id, "x"); err == nil {
		t.Fatal("other user should not be able to add to default's collection")
	}
	if _, err := s.CollectionItems("other", id); err == nil {
		t.Fatal("other user should not read default's collection items")
	}
	cols, _ := s.ListCollections("other")
	if len(cols) != 0 {
		t.Fatalf("other user should see no collections, got %v", cols)
	}
}
