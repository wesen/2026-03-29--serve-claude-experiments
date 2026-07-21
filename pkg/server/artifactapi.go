package server

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/go-go-golems/serve-artifacts/pkg/artifacts"
)

// maxPushBytes caps an uploaded artifact source so a single request cannot
// exhaust memory. Artifacts are hand-sized documents; this is generous.
const maxPushBytes = 8 << 20 // 8 MiB

// action names the kind of access a request needs. Reads are open; writes flow
// through authorize so a real check can be dropped in later.
type action int

const (
	actionRead action = iota
	actionWrite
)

// authorize reports whether the request may perform action. Reads are always
// open. Writes are gated by a single shared bearer token (a deliberately simple,
// "fake" check standing in for a real IdP): when a write token is configured, a
// mutating request must present `Authorization: Bearer <token>`; when none is
// configured, writes are open and a warning was logged at startup. This is the
// one function a real token/IdP check replaces — routing and handlers do not
// change.
func (s *Server) authorize(r *http.Request, act action) error {
	if act != actionWrite {
		return nil
	}
	if s.writeToken == "" {
		return nil // unauthenticated writes (dev/local); startup logged a warning
	}
	presented := bearerToken(r)
	if presented == "" {
		return errors.New("missing write token (Authorization: Bearer <token>)")
	}
	// Constant-time compare so a wrong token can't be recovered by timing.
	if subtle.ConstantTimeCompare([]byte(presented), []byte(s.writeToken)) != 1 {
		return errors.New("invalid write token")
	}
	return nil
}

// bearerToken extracts the token from an `Authorization: Bearer <token>` header,
// returning "" when the header is absent or not a bearer scheme.
func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(h) >= len(prefix) && strings.EqualFold(h[:len(prefix)], prefix) {
		return strings.TrimSpace(h[len(prefix):])
	}
	return ""
}

// requireWrite wraps a handler so it runs only when the request is authorized to
// mutate the corpus. On denial it returns 403 and never calls the handler.
func (s *Server) requireWrite(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := s.authorize(r, actionWrite); err != nil {
			writeError(w, http.StatusForbidden, err)
			return
		}
		h(w, r)
	}
}

// writeError writes a uniform JSON error body ({"error": "..."}) with the given
// status, so every client renders failures the same way.
func writeError(w http.ResponseWriter, status int, err error) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
}

// writeNotFoundJSON reports a missing artifact as the server's JSON error shape
// ({"error":"artifact not found: <name>"}) rather than Go's default-mux
// plaintext "404 page not found". Every /api handler must speak JSON, so a
// client decoding the response gets a structured error instead of an opaque
// text blob that looks indistinguishable from a routing miss.
func writeNotFoundJSON(w http.ResponseWriter, name string) {
	writeError(w, http.StatusNotFound, fmt.Errorf("artifact not found: %s", name))
}

// corpusStatus maps a corpus-write error to an HTTP status: a bad name or type is
// a client error (400), a collision is 409, anything else is 500.
func corpusStatus(err error) int {
	switch {
	case errors.Is(err, artifacts.ErrBadArtifactName), errors.Is(err, artifacts.ErrUnsupportedType):
		return http.StatusBadRequest
	case errors.Is(err, artifacts.ErrArtifactExists):
		return http.StatusConflict
	default:
		return http.StatusInternalServerError
	}
}

// handleArtifactSource serves an artifact's raw source as text/plain, the machine
// counterpart of /raw kept under the /api prefix for the CLI's `get --source`.
func (s *Server) handleArtifactSource(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	art, err := s.scanner.FindByName(name)
	if err != nil {
		writeNotFoundJSON(w, name)
		return
	}
	http.ServeFile(w, r, art.Path)
}

// handleManifestPut replaces an artifact's manifest wholesale. The body is a full
// ArtifactManifest; omitted fields take their zero value. Returns the applied
// artifact view after rebuilding the index.
func (s *Server) handleManifestPut(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	var m artifacts.ArtifactManifest
	if err := decodeJSON(r, &m); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	s.writeManifestAndRespond(w, r, name, &m)
}

// manifestPatch is a partial manifest: a non-nil pointer means the field is
// present in the request and should overwrite; nil means "leave unchanged". This
// distinguishes an absent key from an explicit empty value (e.g. tags: []).
type manifestPatch struct {
	Title        *string                   `json:"title"`
	Description  *string                   `json:"description"`
	Tags         *[]string                 `json:"tags"`
	OriginalDate *string                   `json:"original_date"`
	Links        *[]artifacts.ArtifactLink `json:"links"`
}

// handleManifestPatch merges the present fields of the request into the artifact's
// current manifest (or an empty one if none exists) and writes the result.
func (s *Server) handleManifestPatch(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	var patch manifestPatch
	if err := decodeJSON(r, &patch); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	art, err := s.scanner.FindByName(name)
	if err != nil {
		writeNotFoundJSON(w, name)
		return
	}
	// Start from the current manifest so unspecified fields are preserved.
	m := artifacts.ArtifactManifest{}
	mp := artifacts.ManifestPathFor(art)
	if cur, lerr := artifacts.LoadManifest(mp); lerr == nil {
		m = *cur
	}
	if patch.Title != nil {
		m.Title = *patch.Title
	}
	if patch.Description != nil {
		m.Description = *patch.Description
	}
	if patch.Tags != nil {
		m.Tags = *patch.Tags
	}
	if patch.OriginalDate != nil {
		m.OriginalDate = *patch.OriginalDate
	}
	if patch.Links != nil {
		m.Links = *patch.Links
	}
	s.writeManifestAndRespond(w, r, name, &m)
}

// writeManifestAndRespond validates and writes a manifest for the named artifact,
// rebuilds the index, and responds with the applied artifact view. It holds the
// corpus write lock for the validate → write → rebuild sequence.
func (s *Server) writeManifestAndRespond(w http.ResponseWriter, r *http.Request, name string, m *artifacts.ArtifactManifest) {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()

	art, err := s.scanner.FindByName(name)
	if err != nil {
		writeNotFoundJSON(w, name)
		return
	}
	if err := artifacts.WriteManifest(artifacts.ManifestPathFor(art), m); err != nil {
		writeError(w, http.StatusBadRequest, err) // validation failure is a client error
		return
	}
	if err := s.index.rebuild(); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if !s.writeArtifactView(w, r, name) {
		// The manifest was written and the index rebuilt, but the artifact then
		// vanished from a re-scan (a race with an external writer). Report the
		// inconsistency as a JSON error rather than a plaintext 404 so a client
		// can tell a real "not found" from this transient post-write miss apart.
		writeNotFoundJSON(w, name)
	}
}

// pushRequest is the JSON body of POST /api/artifacts.
type pushRequest struct {
	Name      string                      `json:"name"`      // artifact Name (no extension)
	Type      string                      `json:"type"`      // "html" | "jsx"
	Source    string                      `json:"source"`    // artifact source text
	Manifest  *artifacts.ArtifactManifest `json:"manifest"`  // optional metadata sidecar
	Overwrite bool                        `json:"overwrite"` // replace an existing artifact
}

// handleArtifactPush creates a new artifact from a JSON or multipart request:
// validates the target name and type, refuses an existing target unless overwrite
// is set, writes the source (and optional manifest) atomically, rebuilds the
// index, and returns 201 with the new artifact view.
func (s *Server) handleArtifactPush(w http.ResponseWriter, r *http.Request) {
	req, err := parsePushRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	ext, err := artifacts.ExtensionForType(req.Type)
	if err != nil {
		writeError(w, corpusStatus(err), err)
		return
	}

	s.writeMu.Lock()
	defer s.writeMu.Unlock()

	abs, err := artifacts.SafeArtifactPath(s.dir, req.Name, ext)
	if err != nil {
		writeError(w, corpusStatus(err), err)
		return
	}

	// Names are extensionless logical keys throughout the server. Scan before
	// writing so demo.html and demo.jsx cannot coexist under the same key.
	scanned, scanErr := s.scanner.Scan()
	if scanErr != nil {
		writeError(w, http.StatusInternalServerError, scanErr)
		return
	}
	var existing *artifacts.Artifact
	for i := range scanned {
		if scanned[i].Name == req.Name {
			existing = &scanned[i]
			break
		}
	}
	if existing != nil && !req.Overwrite {
		writeError(w, corpusStatus(artifacts.ErrArtifactExists), artifacts.ErrArtifactExists)
		return
	}

	// Validate before touching the source file. WriteManifest validates too, but
	// doing the preflight here prevents a bad manifest from leaving a source file
	// behind after the API has returned 400.
	if req.Manifest != nil {
		if err := artifacts.ValidateManifest(req.Manifest); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
	}

	// The manifest sits next to the source; derive its path the same way the
	// scanner matches it (source path, extension -> .manifest.json).
	manifestPath := abs[:len(abs)-len(ext)] + ".manifest.json"
	oldPath := ""
	oldManifestPath := ""
	if existing != nil && existing.Path != abs {
		oldPath = existing.Path
		oldManifestPath = existing.ManifestPath
	}

	if err := artifacts.WriteFileAtomic(abs, []byte(req.Source)); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	// Preserve an existing manifest when an overwrite does not supply a new one,
	// moving it along with a cross-type replacement so it cannot remain orphaned.
	manifestMoved := false
	if req.Manifest != nil {
		if err := artifacts.WriteManifest(manifestPath, req.Manifest); err != nil {
			_ = os.Remove(abs)
			writeError(w, http.StatusInternalServerError, err)
			return
		}
	} else if oldManifestPath != "" && oldManifestPath != manifestPath {
		if err := os.Rename(oldManifestPath, manifestPath); err != nil {
			_ = os.Remove(abs)
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		manifestMoved = true
	}

	// Remove the old source only after the replacement is safely written. If
	// cleanup fails, roll back the new files so two artifacts cannot share a key.
	if oldPath != "" {
		if err := os.Remove(oldPath); err != nil && !os.IsNotExist(err) {
			_ = os.Remove(abs)
			if req.Manifest != nil {
				_ = os.Remove(manifestPath)
			}
			if manifestMoved {
				_ = os.Rename(manifestPath, oldManifestPath)
			}
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		if oldManifestPath != "" && oldManifestPath != manifestPath && !manifestMoved {
			_ = os.Remove(oldManifestPath)
		}
	}

	if err := s.index.rebuild(); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	// Commit 201 before writeArtifactView writes the body. writeArtifactView calls
	// writeJSON, which only writes headers if none have been committed yet, so the
	// Created status is preserved and the body follows it.
	w.WriteHeader(http.StatusCreated)
	if !s.writeArtifactView(w, r, req.Name) {
		// The write and rebuild succeeded but the artifact then vanished from a
		// re-scan (a race with an external writer). Report the inconsistency as a
		// structured JSON error rather than a plaintext 404 that would mask the
		// fact that the write itself succeeded. The status is already 201, so
		// writeError's WriteHeader is a no-op; the JSON body is what the client sees.
		writeNotFoundJSON(w, req.Name)
	}
}

// parsePushRequest reads a push body as JSON or multipart/form-data.
func parsePushRequest(r *http.Request) (*pushRequest, error) {
	ct := r.Header.Get("Content-Type")
	if len(ct) >= 19 && ct[:19] == "multipart/form-data" {
		return parseMultipartPush(r)
	}
	var req pushRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, maxPushBytes)).Decode(&req); err != nil {
		return nil, err
	}
	return &req, nil
}

// parseMultipartPush reads a push from a multipart form: a `file` part (the
// source), and `name`, `type`, `manifest`, `overwrite` fields.
func parseMultipartPush(r *http.Request) (*pushRequest, error) {
	if err := r.ParseMultipartForm(maxPushBytes); err != nil {
		return nil, err
	}
	req := &pushRequest{
		Name:      r.FormValue("name"),
		Type:      r.FormValue("type"),
		Overwrite: r.FormValue("overwrite") == "true",
	}
	if f, _, err := r.FormFile("file"); err == nil {
		defer f.Close()
		b, err := io.ReadAll(io.LimitReader(f, maxPushBytes))
		if err != nil {
			return nil, err
		}
		req.Source = string(b)
	}
	if ms := r.FormValue("manifest"); ms != "" {
		var m artifacts.ArtifactManifest
		if err := json.Unmarshal([]byte(ms), &m); err != nil {
			return nil, err
		}
		req.Manifest = &m
	}
	return req, nil
}

// decodeJSON strictly decodes a JSON request body into v, rejecting a body that is
// empty or malformed.
func decodeJSON(r *http.Request, v any) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, maxPushBytes))
	return dec.Decode(v)
}
