// main.go
// the main router and server entrypoint
package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"toronto-census/internal/cache"
	"toronto-census/internal/router"
)

func main() {
	addr            := env("ADDR",              ":8080")
	figuresGRPCAddr := env("FIGURES_GRPC_ADDR", "127.0.0.1:50051")
	origin          := env("ALLOWED_ORIGIN",    "http://localhost:3000")
	cacheTTL        := 10 * time.Minute

	c       := cache.New(cacheTTL)
	ro      := router.New(figuresGRPCAddr, c)
	handler := ro.Build([]string{origin})

	// expose Close so main can drain the connection
	defer ro.Close()

	log.Printf("Go server listening on %s", addr)
	log.Printf("Proxying figures → %s", figuresGRPCAddr)
	log.Fatal(http.ListenAndServe(addr, handler))
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}