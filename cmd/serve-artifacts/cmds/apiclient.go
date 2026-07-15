package cmds

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// apiClient is a thin HTTP client for the serve-artifacts API. It centralizes the
// base URL and the (future) auth token so no individual verb has to think about
// either. It is deliberately small: net/http plus JSON.
type apiClient struct {
	base  string
	token string // reserved for future auth; sent as a Bearer header when set
	http  *http.Client
}

// newAPIClient builds a client. An empty base falls back to the env var and then
// to localhost; an empty token likewise falls back to the env var.
func newAPIClient(base, token string) *apiClient {
	base = firstNonEmpty(base, os.Getenv("SERVE_ARTIFACTS_API"), "http://localhost:8080")
	token = firstNonEmpty(token, os.Getenv("SERVE_ARTIFACTS_TOKEN"))
	return &apiClient{
		base:  strings.TrimRight(base, "/"),
		token: token,
		http:  &http.Client{Timeout: 30 * time.Second},
	}
}

// do issues a request and returns the response. The caller closes the body.
func (c *apiClient) do(ctx context.Context, method, path string, body io.Reader, contentType string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	return c.http.Do(req)
}

// getJSON GETs path and decodes a 2xx JSON body into out. A non-2xx response is
// turned into the server's {"error": ...} message (or the raw body).
func (c *apiClient) getJSON(ctx context.Context, path string, out any) error {
	resp, err := c.do(ctx, http.MethodGet, path, nil, "")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return decodeResponse(resp, out)
}

// sendJSON sends method+path with a JSON-encoded body and decodes a 2xx JSON body
// into out (out may be nil to ignore the response body).
func (c *apiClient) sendJSON(ctx context.Context, method, path string, in, out any) error {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(in); err != nil {
		return err
	}
	resp, err := c.do(ctx, method, path, &buf, "application/json")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return decodeResponse(resp, out)
}

// decodeResponse maps a non-2xx to an error carrying the server's message, and
// otherwise decodes the body into out (if non-nil).
func decodeResponse(resp *http.Response, out any) error {
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("%s: %s", resp.Status, serverErrorMessage(resp.Body))
	}
	if out == nil {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// serverErrorMessage extracts the {"error": "..."} field from a body, falling back
// to the raw (truncated) body when it is not the standard error shape.
func serverErrorMessage(r io.Reader) string {
	b, _ := io.ReadAll(io.LimitReader(r, 8<<10))
	var e struct {
		Error string `json:"error"`
	}
	if json.Unmarshal(b, &e) == nil && e.Error != "" {
		return e.Error
	}
	return strings.TrimSpace(string(b))
}

// firstNonEmpty returns the first non-empty string among its arguments.
func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
