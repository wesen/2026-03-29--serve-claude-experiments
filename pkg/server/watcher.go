package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/fsnotify/fsnotify"
)

// watcher monitors the artifacts directory and notifies connected SSE clients.
type watcher struct {
	dir     string
	clients map[chan struct{}]struct{}
	mu      sync.Mutex
}

func newWatcher(dir string) *watcher {
	return &watcher{
		dir:     dir,
		clients: make(map[chan struct{}]struct{}),
	}
}

// start begins watching the directory for changes. It blocks until ctx is done.
func (w *watcher) start(ctx context.Context) error {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("creating fsnotify watcher: %w", err)
	}
	defer fsw.Close()

	if err := fsw.Add(w.dir); err != nil {
		return fmt.Errorf("watching directory %s: %w", w.dir, err)
	}

	log.Printf("Watching %s for changes", w.dir)

	for {
		select {
		case <-ctx.Done():
			return nil
		case event, ok := <-fsw.Events:
			if !ok {
				return nil
			}
			if event.Has(fsnotify.Write) || event.Has(fsnotify.Create) || event.Has(fsnotify.Remove) {
				log.Printf("File changed: %s (%s)", event.Name, event.Op)
				w.broadcast()
			}
		case err, ok := <-fsw.Errors:
			if !ok {
				return nil
			}
			log.Printf("Watcher error: %v", err)
		}
	}
}

func (w *watcher) broadcast() {
	w.mu.Lock()
	defer w.mu.Unlock()
	for ch := range w.clients {
		select {
		case ch <- struct{}{}:
		default:
			// client not ready, skip
		}
	}
}

func (w *watcher) subscribe() chan struct{} {
	ch := make(chan struct{}, 1)
	w.mu.Lock()
	w.clients[ch] = struct{}{}
	w.mu.Unlock()
	return ch
}

func (w *watcher) unsubscribe(ch chan struct{}) {
	w.mu.Lock()
	delete(w.clients, ch)
	w.mu.Unlock()
}

// handleSSE serves Server-Sent Events for file change notifications.
func (w *watcher) handleSSE(wr http.ResponseWriter, r *http.Request) {
	flusher, ok := wr.(http.Flusher)
	if !ok {
		http.Error(wr, "SSE not supported", http.StatusInternalServerError)
		return
	}

	wr.Header().Set("Content-Type", "text/event-stream")
	wr.Header().Set("Cache-Control", "no-cache")
	wr.Header().Set("Connection", "keep-alive")

	ch := w.subscribe()
	defer w.unsubscribe(ch)

	// Send initial connected event
	fmt.Fprintf(wr, "data: connected\n\n")
	flusher.Flush()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ch:
			fmt.Fprintf(wr, "data: reload\n\n")
			flusher.Flush()
		}
	}
}
