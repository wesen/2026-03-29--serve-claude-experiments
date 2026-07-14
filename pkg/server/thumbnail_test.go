package server

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/png"
	"sync"
	"sync/atomic"
	"testing"
)

// fakeEngine is a Thumbnailer that returns a fixed PNG and counts how many times
// Render is called, so tests can assert caching and singleflight behavior
// without launching a browser.
type fakeEngine struct {
	calls    atomic.Int32
	png      []byte
	renderOK bool
	err      error
	block    chan struct{} // if non-nil, Render blocks until closed (to force overlap)
}

func (e *fakeEngine) Render(ctx context.Context, viewURL, hash string) ([]byte, bool, error) {
	e.calls.Add(1)
	if e.block != nil {
		<-e.block
	}
	if e.err != nil {
		return nil, false, e.err
	}
	return e.png, e.renderOK, nil
}

func (e *fakeEngine) Close() {}

func makePNG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode: %v", err)
	}
	return buf.Bytes()
}

func TestThumbCacheGeneratesOnceThenServesFromDisk(t *testing.T) {
	eng := &fakeEngine{png: makePNG(t, thumbRenderW, thumbRenderH), renderOK: true}
	c, err := newThumbCache(t.TempDir(), "http://localhost:0", eng, 2)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	b1, err := c.get(ctx, "foo/bar", "hash1")
	if err != nil {
		t.Fatalf("first get: %v", err)
	}
	if len(b1) == 0 {
		t.Fatal("empty thumbnail")
	}
	// Second call for the same hash must not render again (disk cache hit).
	if _, err := c.get(ctx, "foo/bar", "hash1"); err != nil {
		t.Fatalf("second get: %v", err)
	}
	if got := eng.calls.Load(); got != 1 {
		t.Fatalf("expected 1 render, got %d", got)
	}
	// renderOK bit recorded.
	if ok, known := c.renderStatus("hash1"); !known || !ok {
		t.Fatalf("renderStatus = (%v,%v), want (true,true)", ok, known)
	}
	// The downscale ran: decoding the stored bytes gives width == thumbWidth.
	img, err := png.Decode(bytes.NewReader(b1))
	if err != nil {
		t.Fatalf("decode stored thumb: %v", err)
	}
	if img.Bounds().Dx() != thumbWidth {
		t.Fatalf("stored thumb width = %d, want %d", img.Bounds().Dx(), thumbWidth)
	}
}

func TestThumbCacheSingleflightCollapsesConcurrentRenders(t *testing.T) {
	block := make(chan struct{})
	eng := &fakeEngine{png: makePNG(t, thumbRenderW, thumbRenderH), renderOK: true, block: block}
	c, err := newThumbCache(t.TempDir(), "http://localhost:0", eng, 4)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	const n = 8
	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			_, _ = c.get(ctx, "same/name", "sharedhash")
		}()
	}
	// Let goroutines pile up on the single flight, then release the render.
	// (No sleep — closing the channel is the barrier; singleflight guarantees
	// only one goroutine is inside Render regardless of scheduling.)
	close(block)
	wg.Wait()

	if got := eng.calls.Load(); got != 1 {
		t.Fatalf("expected singleflight to collapse to 1 render, got %d", got)
	}
}

func TestThumbCacheRenderErrorPropagates(t *testing.T) {
	eng := &fakeEngine{err: errors.New("boom")}
	c, err := newThumbCache(t.TempDir(), "http://localhost:0", eng, 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.get(context.Background(), "n", "h"); err == nil {
		t.Fatal("expected error from failing render")
	}
	// A failed render writes nothing, so a later successful engine can retry.
	if _, cached := c.cachedPath("h"); cached {
		t.Fatal("failed render should not have cached a file")
	}
}

func TestDownscalePNGKeepsSmallImages(t *testing.T) {
	small := makePNG(t, 100, 80)
	out, err := downscalePNG(small, thumbWidth)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(out, small) {
		t.Fatal("images already narrower than thumbWidth should be returned unchanged")
	}
}
