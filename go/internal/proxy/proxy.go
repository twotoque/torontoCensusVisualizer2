// internal/proxy/proxy.go
//
// The core of what Go does: check cache, call Python if needed, cache result.
// Every route handler calls one of these three functions. Nothing else.
//
// Adding a future LLM or ML service means adding a new Proxy instance
// pointed at a different pythonURL — the pattern is identical.

package proxy

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"

	"toronto-census/internal/cache"
)

// Proxy forwards requests to a backend service and caches responses.
// One Proxy per backend service (Python figures, future ML, future LLM).
type Proxy struct {
	backendURL string
	cache      *cache.Cache
	name       string // for logging
}

func New(backendURL, name string, c *cache.Cache) *Proxy {
	return &Proxy{backendURL: backendURL, cache: c, name: name}
}

// Get forwards a GET request. If cacheKey is non-empty, the response is
// cached and served from cache on subsequent identical requests.
// Pass cacheKey="" to skip caching (e.g. search results).
func (p *Proxy) Get(w http.ResponseWriter, backendPath, cacheKey, contentType string) {
	// 1. cache bypasses python 
	if cacheKey != "" {
		if cached, ok := p.cache.Get(cacheKey); ok {
			p.write(w, cached, contentType, true)
			return
		}
	}

	// 2. cache miss → call python, return error if it fails
	resp, err := http.Get(p.backendURL + backendPath)
	if err != nil {
		log.Printf("[%s] GET %s error: %v", p.name, backendPath, err)
		http.Error(w, "upstream unavailable", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "read error", http.StatusInternalServerError)
		return
	}

	if resp.StatusCode != http.StatusOK {
		http.Error(w, string(body), resp.StatusCode)
		return
	}

	// 3. cache the successful response for next time, then return it
	if cacheKey != "" {
		p.cache.Set(cacheKey, body)
	}
	p.write(w, body, contentType, false)
}

// Post forwards a POST request with a JSON body.
// Post responses are not cached — the combination space is too large.
func (p *Proxy) Post(w http.ResponseWriter, r *http.Request, backendPath, cacheKey, contentType string) {
	// Read body so we can both cache-key it and forward it
	reqBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "read error", http.StatusBadRequest)
		return
	}

	// Cache check for POST (stack charts with same rows)
	if cacheKey != "" {
		if cached, ok := p.cache.Get(cacheKey); ok {
			p.write(w, cached, contentType, true)
			return
		}
	}

	resp, err := http.Post(
		p.backendURL+backendPath,
		"application/json",
		bytes.NewReader(reqBody),
	)
	if err != nil {
		log.Printf("[%s] POST %s error: %v", p.name, backendPath, err)
		http.Error(w, "upstream unavailable", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "read error", http.StatusInternalServerError)
		return
	}

	if resp.StatusCode != http.StatusOK {
		http.Error(w, string(body), resp.StatusCode)
		return
	}

	if cacheKey != "" {
		p.cache.Set(cacheKey, body)
	}
	p.write(w, body, contentType, false)
}

// Stream forwards a request and streams the response directly to the client.
// Used for PDF exports — Go doesn't buffer, just pipes bytes through.
func (p *Proxy) Stream(w http.ResponseWriter, r *http.Request, backendPath, filename string) {
	var resp *http.Response
	var err error

	if r.Method == http.MethodPost {
		body, _ := io.ReadAll(r.Body)
		resp, err = http.Post(p.backendURL+backendPath, "application/json", bytes.NewReader(body))
	} else {
		resp, err = http.Get(p.backendURL + backendPath)
	}

	if err != nil {
		log.Printf("[%s] stream %s error: %v", p.name, backendPath, err)
		http.Error(w, "upstream unavailable", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	io.Copy(w, resp.Body)
}

func (p *Proxy) write(w http.ResponseWriter, data []byte, contentType string, fromCache bool) {
	w.Header().Set("Content-Type", contentType)
	if fromCache {
		w.Header().Set("X-Cache", "HIT")
	} else {
		w.Header().Set("X-Cache", "MISS")
	}
	w.Write(data)
}