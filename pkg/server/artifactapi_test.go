package server

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// newTestServer builds a Server over a temp artifact dir with thumbnails disabled
// (no headless Chrome in tests) and returns it plus an httptest server exercising
// the full router. The initial index is built before returning.
func newTestServer(t *testing.T) (*Server, *httptest.Server) {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "hello.html"),
		[]byte("<!doctype html><title>Hello</title><body>hi</body>"), 0o644); err != nil {
		t.Fatal(err)
	}
	s, err := New(Config{
		Dir:      dir,
		Port:     0,
		NoThumbs: true,
		DBPath:   filepath.Join(t.TempDir(), "userdata.db"),
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := s.index.rebuild(); err != nil {
		t.Fatalf("rebuild: %v", err)
	}
	ts := httptest.NewServer(s.registerRoutes())
	t.Cleanup(ts.Close)
	return s, ts
}

func doReq(t *testing.T, method, url, contentType string, body io.Reader) (*http.Response, []byte) {
	t.Helper()
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		t.Fatal(err)
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp, b
}

func TestListAndViewSource(t *testing.T) {
	_, ts := newTestServer(t)

	resp, b := doReq(t, "GET", ts.URL+"/api/artifacts", "", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("list status = %d", resp.StatusCode)
	}
	var list struct {
		Total   int              `json:"total"`
		Results []map[string]any `json:"results"`
	}
	if err := json.Unmarshal(b, &list); err != nil {
		t.Fatalf("decode list: %v (%s)", err, b)
	}
	if list.Total != 1 || list.Results[0]["name"] != "hello" {
		t.Fatalf("list = %+v", list)
	}

	resp, b = doReq(t, "GET", ts.URL+"/api/source/hello", "", nil)
	if resp.StatusCode != 200 || !strings.Contains(string(b), "<body>hi</body>") {
		t.Fatalf("source status=%d body=%q", resp.StatusCode, b)
	}

	resp, _ = doReq(t, "GET", ts.URL+"/api/source/nope", "", nil)
	if resp.StatusCode != 404 {
		t.Fatalf("missing source status = %d, want 404", resp.StatusCode)
	}
}

func TestPushCreatesArtifactAndIsVisible(t *testing.T) {
	s, ts := newTestServer(t)

	body := `{"name":"demos/app","type":"html","source":"<title>App</title>","manifest":{"tags":["demo"]}}`
	resp, b := doReq(t, "POST", ts.URL+"/api/artifacts", "application/json", strings.NewReader(body))
	if resp.StatusCode != 201 {
		t.Fatalf("push status = %d body=%s", resp.StatusCode, b)
	}

	// File and manifest landed on disk.
	if _, err := os.Stat(filepath.Join(s.dir, "demos/app.html")); err != nil {
		t.Fatalf("source not written: %v", err)
	}
	if _, err := os.Stat(filepath.Join(s.dir, "demos/app.manifest.json")); err != nil {
		t.Fatalf("manifest not written: %v", err)
	}

	// Immediately visible via list (index was rebuilt before the response).
	resp, b = doReq(t, "GET", ts.URL+"/api/artifacts?q=app", "", nil)
	var list struct {
		Total int `json:"total"`
	}
	_ = json.Unmarshal(b, &list)
	if resp.StatusCode != 200 || list.Total < 1 {
		t.Fatalf("pushed artifact not visible: status=%d total=%d", resp.StatusCode, list.Total)
	}
}

func TestPushRejectsTraversalAndBadType(t *testing.T) {
	_, ts := newTestServer(t)

	trav := `{"name":"../evil","type":"html","source":"x"}`
	if resp, _ := doReq(t, "POST", ts.URL+"/api/artifacts", "application/json", strings.NewReader(trav)); resp.StatusCode != 400 {
		t.Fatalf("traversal status = %d, want 400", resp.StatusCode)
	}

	badType := `{"name":"ok","type":"exe","source":"x"}`
	if resp, _ := doReq(t, "POST", ts.URL+"/api/artifacts", "application/json", strings.NewReader(badType)); resp.StatusCode != 400 {
		t.Fatalf("bad type status = %d, want 400", resp.StatusCode)
	}
}

func TestPushConflictUnlessOverwrite(t *testing.T) {
	_, ts := newTestServer(t)

	first := `{"name":"dup","type":"html","source":"<title>one</title>"}`
	if resp, b := doReq(t, "POST", ts.URL+"/api/artifacts", "application/json", strings.NewReader(first)); resp.StatusCode != 201 {
		t.Fatalf("first push = %d %s", resp.StatusCode, b)
	}

	again := `{"name":"dup","type":"html","source":"<title>two</title>"}`
	if resp, _ := doReq(t, "POST", ts.URL+"/api/artifacts", "application/json", strings.NewReader(again)); resp.StatusCode != 409 {
		t.Fatalf("conflict status = %d, want 409", resp.StatusCode)
	}

	over := `{"name":"dup","type":"html","source":"<title>two</title>","overwrite":true}`
	if resp, b := doReq(t, "POST", ts.URL+"/api/artifacts", "application/json", strings.NewReader(over)); resp.StatusCode != 201 {
		t.Fatalf("overwrite status = %d %s", resp.StatusCode, b)
	}
}

func TestPushRejectsCrossTypeCollisionAndOverwritesAcrossTypes(t *testing.T) {
	s, ts := newTestServer(t)

	first := `{"name":"dup","type":"jsx","source":"export default function Dup() {}"}`
	if resp, b := doReq(t, "POST", ts.URL+"/api/artifacts", "application/json", strings.NewReader(first)); resp.StatusCode != 201 {
		t.Fatalf("first push = %d %s", resp.StatusCode, b)
	}

	crossType := `{"name":"dup","type":"html","source":"<title>two</title>"}`
	if resp, _ := doReq(t, "POST", ts.URL+"/api/artifacts", "application/json", strings.NewReader(crossType)); resp.StatusCode != 409 {
		t.Fatalf("cross-type conflict status = %d, want 409", resp.StatusCode)
	}
	if _, err := os.Stat(filepath.Join(s.dir, "dup.html")); !os.IsNotExist(err) {
		t.Fatalf("cross-type conflict created dup.html: err=%v", err)
	}

	over := `{"name":"dup","type":"html","source":"<title>two</title>","overwrite":true}`
	if resp, b := doReq(t, "POST", ts.URL+"/api/artifacts", "application/json", strings.NewReader(over)); resp.StatusCode != 201 {
		t.Fatalf("cross-type overwrite = %d %s", resp.StatusCode, b)
	}
	if _, err := os.Stat(filepath.Join(s.dir, "dup.jsx")); !os.IsNotExist(err) {
		t.Fatalf("old cross-type source remains: err=%v", err)
	}
	if _, err := os.Stat(filepath.Join(s.dir, "dup.html")); err != nil {
		t.Fatalf("new cross-type source missing: %v", err)
	}

	resp, body := doReq(t, "GET", ts.URL+"/api/artifacts", "", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("list after cross-type overwrite = %d %s", resp.StatusCode, body)
	}
	var list struct {
		Total int `json:"total"`
	}
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatal(err)
	}
	if list.Total != 2 {
		t.Fatalf("list after cross-type overwrite total = %d, want 2", list.Total)
	}
}

func TestPushInvalidManifestDoesNotLeaveSource(t *testing.T) {
	s, ts := newTestServer(t)

	bad := `{"name":"orphan","type":"html","source":"<title>Orphan</title>","manifest":{"original_date":"not-a-date"}}`
	if resp, _ := doReq(t, "POST", ts.URL+"/api/artifacts", "application/json", strings.NewReader(bad)); resp.StatusCode != 400 {
		t.Fatalf("invalid manifest status = %d, want 400", resp.StatusCode)
	}
	if _, err := os.Stat(filepath.Join(s.dir, "orphan.html")); !os.IsNotExist(err) {
		t.Fatalf("invalid manifest left source behind: err=%v", err)
	}

	good := `{"name":"orphan","type":"html","source":"<title>Orphan</title>"}`
	if resp, b := doReq(t, "POST", ts.URL+"/api/artifacts", "application/json", strings.NewReader(good)); resp.StatusCode != 201 {
		t.Fatalf("retry after invalid manifest = %d %s", resp.StatusCode, b)
	}
}

// artifactView decodes the single-artifact detail body enough for assertions.
type artifactView struct {
	Artifact struct {
		Title string   `json:"title"`
		Tags  []string `json:"tags"`
	} `json:"artifact"`
}

func getView(t *testing.T, ts *httptest.Server, name string) artifactView {
	t.Helper()
	_, b := doReq(t, "GET", ts.URL+"/api/artifact/"+name, "", nil)
	var v artifactView
	if err := json.Unmarshal(b, &v); err != nil {
		t.Fatalf("decode view: %v (%s)", err, b)
	}
	return v
}

func TestManifestPutReplaces(t *testing.T) {
	_, ts := newTestServer(t)

	put := `{"title":"Renamed","description":"d","tags":["x","y"]}`
	resp, b := doReq(t, "PUT", ts.URL+"/api/manifest/hello", "application/json", strings.NewReader(put))
	if resp.StatusCode != 200 {
		t.Fatalf("put status = %d %s", resp.StatusCode, b)
	}
	v := getView(t, ts, "hello")
	if v.Artifact.Title != "Renamed" || len(v.Artifact.Tags) != 2 {
		t.Fatalf("view after put = %+v", v.Artifact)
	}
}

func TestManifestPatchMergesAndPreserves(t *testing.T) {
	_, ts := newTestServer(t)

	// Seed tags via PUT, then PATCH only the description.
	doReq(t, "PUT", ts.URL+"/api/manifest/hello", "application/json",
		strings.NewReader(`{"title":"T","tags":["keep"]}`))
	resp, b := doReq(t, "PATCH", ts.URL+"/api/manifest/hello", "application/json",
		strings.NewReader(`{"description":"new desc"}`))
	if resp.StatusCode != 200 {
		t.Fatalf("patch status = %d %s", resp.StatusCode, b)
	}
	v := getView(t, ts, "hello")
	if len(v.Artifact.Tags) != 1 || v.Artifact.Tags[0] != "keep" {
		t.Fatalf("patch dropped preserved tags: %+v", v.Artifact)
	}
	if v.Artifact.Title != "T" {
		t.Fatalf("patch dropped preserved title: %+v", v.Artifact)
	}
}

func TestManifestInvalidIsBadRequest(t *testing.T) {
	_, ts := newTestServer(t)
	bad := `{"original_date":"not-a-date"}`
	if resp, _ := doReq(t, "PUT", ts.URL+"/api/manifest/hello", "application/json", strings.NewReader(bad)); resp.StatusCode != 400 {
		t.Fatalf("invalid manifest status = %d, want 400", resp.StatusCode)
	}
}

// newTokenServer is like newTestServer but configures a write token.
func newTokenServer(t *testing.T, token string) *httptest.Server {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "hello.html"), []byte("<title>Hello</title>"), 0o644); err != nil {
		t.Fatal(err)
	}
	s, err := New(Config{Dir: dir, NoThumbs: true, DBPath: filepath.Join(t.TempDir(), "userdata.db"), WriteToken: token})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := s.index.rebuild(); err != nil {
		t.Fatalf("rebuild: %v", err)
	}
	ts := httptest.NewServer(s.registerRoutes())
	t.Cleanup(ts.Close)
	return ts
}

func doReqAuth(t *testing.T, method, url, token, body string) int {
	t.Helper()
	req, err := http.NewRequest(method, url, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	return resp.StatusCode
}

func TestWriteTokenGate(t *testing.T) {
	ts := newTokenServer(t, "s3cret")
	man := `{"title":"T"}`

	// Reads stay open without a token.
	if code := doReqAuth(t, "GET", ts.URL+"/api/artifacts", "", ""); code != 200 {
		t.Fatalf("list without token = %d, want 200", code)
	}
	// Write without a token is forbidden.
	if code := doReqAuth(t, "PUT", ts.URL+"/api/manifest/hello", "", man); code != 403 {
		t.Fatalf("write without token = %d, want 403", code)
	}
	// Write with the wrong token is forbidden.
	if code := doReqAuth(t, "PUT", ts.URL+"/api/manifest/hello", "wrong", man); code != 403 {
		t.Fatalf("write with wrong token = %d, want 403", code)
	}
	// Write with the correct token succeeds.
	if code := doReqAuth(t, "PUT", ts.URL+"/api/manifest/hello", "s3cret", man); code != 200 {
		t.Fatalf("write with correct token = %d, want 200", code)
	}
}

func TestManifestOnMissingArtifactIs404(t *testing.T) {
	_, ts := newTestServer(t)
	if resp, _ := doReq(t, "PUT", ts.URL+"/api/manifest/ghost", "application/json", bytes.NewReader([]byte(`{"title":"x"}`))); resp.StatusCode != 404 {
		t.Fatalf("manifest on missing artifact = %d, want 404", resp.StatusCode)
	}
}
