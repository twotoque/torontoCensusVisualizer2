// internal/cache/cache.go
// Thread-safe in-memory TTL cache.
// Go caches Python's responses so Python is only called once per unique request.

package cache

import (
	"sync"
	"time"
)

type entry struct {
	data      []byte
	expiresAt time.Time
}

type Cache struct {
	mu    sync.RWMutex
	items map[string]entry
	ttl   time.Duration
}

func New(ttl time.Duration) *Cache {
	c := &Cache{
		items: make(map[string]entry),
		ttl:   ttl,
	}
	go c.evictLoop()
	return c
}

func (c *Cache) Get(key string) ([]byte, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.items[key]
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.data, true
}

func (c *Cache) Set(key string, data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = entry{
		data:      data,
		expiresAt: time.Now().Add(c.ttl),
	}
}

func (c *Cache) evictLoop() {
	for range time.Tick(5 * time.Minute) {
		c.mu.Lock()
		now := time.Now()
		for k, e := range c.items {
			if now.After(e.expiresAt) {
				delete(c.items, k)
			}
		}
		c.mu.Unlock()
	}
}