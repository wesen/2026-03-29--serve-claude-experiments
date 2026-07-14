package server

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	cdpruntime "github.com/chromedp/cdproto/runtime"
	"github.com/chromedp/chromedp"
	xdraw "golang.org/x/image/draw"
	"golang.org/x/sync/singleflight"
)

// thumbWidth is the width (px) thumbnails are downscaled to. Renders happen at a
// larger viewport (thumbRenderW × thumbRenderH) and are resized down so the
// stored PNGs stay small enough to send a gallery of them at once.
const (
	thumbWidth    = 480
	thumbRenderW  = 1200
	thumbRenderH  = 900
	renderTimeout = 25 * time.Second
	mountTimeout  = 8 * time.Second
	settleDelay   = 700 * time.Millisecond
)

// Thumbnailer renders an artifact (identified by the /view URL that runs it) to a
// PNG. renderOK reports whether the artifact mounted without a console error or
// uncaught exception, which the reliability/health check (§6 of the design)
// reuses at no extra cost. hash is used only for logging/keying.
type Thumbnailer interface {
	Render(ctx context.Context, viewURL, hash string) (png []byte, renderOK bool, err error)
	// Close releases any long-lived resources (e.g. the headless browser).
	Close()
}

// thumbCache generates and caches artifact thumbnails on disk, keyed by content
// hash. It bounds concurrent renders with a semaphore and collapses duplicate
// concurrent requests for the same hash with singleflight, so a gallery of cards
// that all request one missing thumbnail triggers exactly one render.
type thumbCache struct {
	dir     string
	baseURL string // e.g. http://localhost:8080 — the server rendering talks to
	engine  Thumbnailer
	sem     chan struct{}
	sf      singleflight.Group

	mu       sync.RWMutex
	renderOK map[string]bool // hash -> mounted cleanly (only for hashes rendered this run)
}

// newThumbCache builds a cache under dir, rendering via engine, bounded to
// maxConcurrent simultaneous renders.
func newThumbCache(dir, baseURL string, engine Thumbnailer, maxConcurrent int) (*thumbCache, error) {
	if maxConcurrent < 1 {
		maxConcurrent = 1
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("creating thumbnail dir: %w", err)
	}
	return &thumbCache{
		dir:      dir,
		baseURL:  baseURL,
		engine:   engine,
		sem:      make(chan struct{}, maxConcurrent),
		renderOK: map[string]bool{},
	}, nil
}

func (c *thumbCache) pathFor(hash string) string {
	return filepath.Join(c.dir, hash+".png")
}

// cachedPath returns the on-disk thumbnail path if it already exists.
func (c *thumbCache) cachedPath(hash string) (string, bool) {
	p := c.pathFor(hash)
	if _, err := os.Stat(p); err == nil {
		return p, true
	}
	return "", false
}

// get returns the thumbnail bytes for (name, hash), generating and caching them
// on first request. Concurrent callers for the same hash share one render.
func (c *thumbCache) get(ctx context.Context, name, hash string) ([]byte, error) {
	if p, ok := c.cachedPath(hash); ok {
		return os.ReadFile(p)
	}
	v, err, _ := c.sf.Do(hash, func() (interface{}, error) {
		// Re-check inside the flight: a prior duplicate may have just written it.
		if p, ok := c.cachedPath(hash); ok {
			return os.ReadFile(p)
		}
		select {
		case c.sem <- struct{}{}:
			defer func() { <-c.sem }()
		case <-ctx.Done():
			return nil, ctx.Err()
		}
		viewURL := c.baseURL + "/view/" + name
		rctx, cancel := context.WithTimeout(ctx, renderTimeout)
		defer cancel()
		full, ok, rerr := c.engine.Render(rctx, viewURL, hash)
		if rerr != nil {
			return nil, rerr
		}
		small, derr := downscalePNG(full, thumbWidth)
		if derr != nil {
			small = full // fall back to the full-size capture
		}
		if werr := writeFileAtomic(c.pathFor(hash), small); werr != nil {
			log.Printf("thumbnail: write %s: %v", hash, werr)
		}
		c.mu.Lock()
		c.renderOK[hash] = ok
		c.mu.Unlock()
		return small, nil
	})
	if err != nil {
		return nil, err
	}
	return v.([]byte), nil
}

// renderStatus reports the mounted-cleanly bit for a hash, if it was rendered
// this run. known is false when the artifact has not been rendered yet.
func (c *thumbCache) renderStatus(hash string) (ok, known bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	ok, known = c.renderOK[hash]
	return ok, known
}

func (c *thumbCache) close() {
	if c.engine != nil {
		c.engine.Close()
	}
}

// writeFileAtomic writes via a temp file + rename so a crashed render never
// leaves a truncated PNG in the cache.
func writeFileAtomic(path string, data []byte) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".thumb-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return err
	}
	return os.Rename(tmpName, path)
}

// downscalePNG decodes a PNG and resizes it to width w (preserving aspect
// ratio), re-encoding as PNG. Images already at or below w are returned as-is.
func downscalePNG(data []byte, w int) ([]byte, error) {
	src, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	b := src.Bounds()
	if b.Dx() <= w {
		return data, nil
	}
	h := b.Dy() * w / b.Dx()
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, b, xdraw.Over, nil)
	var out bytes.Buffer
	if err := png.Encode(&out, dst); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// placeholderPNG is a small neutral image served when a render fails or is
// unavailable (e.g. no Chrome). Generated once, lazily.
var (
	placeholderOnce  sync.Once
	placeholderBytes []byte
)

func placeholderPNG() []byte {
	placeholderOnce.Do(func() {
		w, h := thumbWidth, thumbWidth*thumbRenderH/thumbRenderW
		img := image.NewRGBA(image.Rect(0, 0, w, h))
		bg := color.RGBA{0xf0, 0xf0, 0xf0, 0xff}
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				img.Set(x, y, bg)
			}
		}
		var buf bytes.Buffer
		_ = png.Encode(&buf, img)
		placeholderBytes = buf.Bytes()
	})
	return placeholderBytes
}

// defaultThumbsDir returns the default thumbnail cache directory under the user
// cache dir; it is never written into the (possibly read-only) artifact tree.
func defaultThumbsDir() string {
	base, err := os.UserCacheDir()
	if err != nil || base == "" {
		return filepath.Join(".", ".serve-artifacts", "thumbs")
	}
	return filepath.Join(base, "serve-artifacts", "thumbs")
}

func defaultThumbConcurrency() int {
	n := runtime.GOMAXPROCS(0)
	if n > 4 {
		n = 4
	}
	if n < 1 {
		n = 1
	}
	return n
}

// ---- chromedp engine ----------------------------------------------------

// chromedpEngine renders artifacts with a single long-lived headless Chrome,
// reused across renders (each render opens a fresh tab). It captures console
// errors and uncaught exceptions to compute renderOK.
type chromedpEngine struct {
	allocCtx    context.Context
	cancelAlloc context.CancelFunc
	browserCtx  context.Context
	cancelBrow  context.CancelFunc
	startOnce   sync.Once
	startErr    error
}

// newChromedpEngine constructs the engine but does not launch Chrome until the
// first Render (so a server with no thumbnails requested never spawns a browser).
func newChromedpEngine() *chromedpEngine { return &chromedpEngine{} }

func (e *chromedpEngine) start() error {
	e.startOnce.Do(func() {
		opts := append(chromedp.DefaultExecAllocatorOptions[:],
			chromedp.Flag("headless", true),
			chromedp.Flag("disable-gpu", true),
			chromedp.Flag("hide-scrollbars", true),
			chromedp.WindowSize(thumbRenderW, thumbRenderH),
		)
		e.allocCtx, e.cancelAlloc = chromedp.NewExecAllocator(context.Background(), opts...)
		e.browserCtx, e.cancelBrow = chromedp.NewContext(e.allocCtx)
		// Force the browser to actually start so a missing binary fails fast.
		e.startErr = chromedp.Run(e.browserCtx)
	})
	return e.startErr
}

func (e *chromedpEngine) Render(ctx context.Context, viewURL, hash string) ([]byte, bool, error) {
	if err := e.start(); err != nil {
		return nil, false, fmt.Errorf("starting headless chrome: %w", err)
	}
	// A fresh tab per render, parented to the shared browser. The tab must be
	// parented to the browser context (not the caller's ctx) so it reuses the
	// running Chrome; caller-ctx cancellation/timeout is propagated to the tab
	// via AfterFunc so a slow render still aborts.
	tabCtx, cancelTab := chromedp.NewContext(e.browserCtx)
	defer cancelTab()
	stop := context.AfterFunc(ctx, cancelTab)
	defer stop()

	var hadError bool
	chromedp.ListenTarget(tabCtx, func(ev interface{}) {
		switch e := ev.(type) {
		case *cdpruntime.EventConsoleAPICalled:
			if e.Type == cdpruntime.APITypeError {
				hadError = true
			}
		case *cdpruntime.EventExceptionThrown:
			hadError = true
		}
	})

	var buf []byte
	// Navigate and wait for the document; the mount poll is best-effort.
	if err := chromedp.Run(tabCtx,
		chromedp.Navigate(viewURL),
		chromedp.WaitReady("body", chromedp.ByQuery),
	); err != nil {
		return nil, false, err
	}
	// Best-effort wait for a JSX mount (#root gains children) or an HTML page
	// (no #root). Errors/timeouts here are ignored — we still screenshot.
	waitCtx, cancelWait := context.WithTimeout(tabCtx, mountTimeout)
	_ = chromedp.Run(waitCtx, chromedp.Poll(
		`(function(){var r=document.getElementById('root');return !r||r.childElementCount>0;})()`,
		nil,
		chromedp.WithPollingTimeout(mountTimeout),
	))
	cancelWait()

	if err := chromedp.Run(tabCtx,
		chromedp.Sleep(settleDelay),
		chromedp.CaptureScreenshot(&buf),
	); err != nil {
		return nil, false, err
	}
	return buf, !hadError, nil
}

func (e *chromedpEngine) Close() {
	if e.cancelBrow != nil {
		e.cancelBrow()
	}
	if e.cancelAlloc != nil {
		e.cancelAlloc()
	}
}
