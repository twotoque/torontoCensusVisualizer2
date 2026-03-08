// internal/router/router.go
//
// All routes live here. Each handler is 3-5 lines:
//   1. Extract URL params
//   2. Build cache key
//   3. Call proxy.Get / proxy.Post / proxy.Stream
//
// Go never inspects the JSON body — it just moves bytes.
// Python decides what the response contains.
//
// To add LLM or ML routes:
//   1. Add a new Proxy field (e.g. mlProxy)
//   2. Add route(s) in Build()
//   3. Add handler(s) below — same 3-line pattern

package router

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"toronto-census/internal/cache"
	"toronto-census/internal/proxy"
)

type Router struct {
	figures *proxy.Proxy
	// ml  *proxy.Proxy  
	// llm *proxy.Proxy   
}

func New(figuresURL string, c *cache.Cache) *Router {
	return &Router{
		figures: proxy.New(figuresURL, "figures", c),
		// ml:  proxy.New(mlURL,  "ml",  c),
		// llm: proxy.New(llmURL, "llm", c),
	}
}

// Build wires all routes and middleware, returns the http.Handler.
func (ro *Router) Build(allowedOrigins []string) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.CleanPath)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{"GET", "POST"},
		AllowedHeaders: []string{"Content-Type"},
	}))

	// census figure routes:
	r.Get("/api/years",                                  ro.getYears)
	r.Get("/api/census/{year}/search",                   ro.search)
	r.Get("/api/census/{year}/row/{row}/map",            ro.getMap)
	r.Get("/api/census/{year}/row/{row}/bar",            ro.getBar)
	r.Post("/api/census/{year}/stack",                   ro.getStack)
	r.Get("/api/census/{year}/row/{row}/export/{kind}",  ro.exportFigure)
	r.Post("/api/census/{year}/export/stack",            ro.exportStack)

	// future ml route?: 
	// r.Get("/api/ml/census/{year}/row/{row}/predict",  ro.mlPredict)
	// r.Post("/api/ml/census/{year}/cluster",           ro.mlCluster)

	// future llm route?
	// r.Post("/api/llm/search",                         ro.llmSearch)

	// react build
	r.Handle("/*", http.FileServer(http.Dir("./static")))

	return r
}

// cenus handliers

func (ro *Router) getYears(w http.ResponseWriter, r *http.Request) {
	ro.figures.Get(w, "/years", "years", "application/json")
}

func (ro *Router) search(w http.ResponseWriter, r *http.Request) {
	year := paramYear(r)
	q    := r.URL.Query().Get("q")
	// don't cache search
	ro.figures.Get(w,
		fmt.Sprintf("/census/%d/search?q=%s", year, q),
		"", 
		"application/json",
	)
}

func (ro *Router) getMap(w http.ResponseWriter, r *http.Request) {
	year, row := paramYear(r), paramRow(r)
	ro.figures.Get(w,
		fmt.Sprintf("/census/%d/row/%d/map", year, row),
		fmt.Sprintf("map:%d:%d", year, row),
		"application/json",
	)
}

func (ro *Router) getBar(w http.ResponseWriter, r *http.Request) {
	year, row := paramYear(r), paramRow(r)
	ro.figures.Get(w,
		fmt.Sprintf("/census/%d/row/%d/bar", year, row),
		fmt.Sprintf("bar:%d:%d", year, row),
		"application/json",
	)
}

func (ro *Router) getStack(w http.ResponseWriter, r *http.Request) {
	year := paramYear(r)

	var body struct {
		Rows []int `json:"rows"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	ro.figures.Post(w, r,
		fmt.Sprintf("/census/%d/stack", year),
		fmt.Sprintf("stack:%d:%v", year, body.Rows),
		"application/json",
	)
}

func (ro *Router) exportFigure(w http.ResponseWriter, r *http.Request) {
	year, row := paramYear(r), paramRow(r)
	kind      := chi.URLParam(r, "kind")
	ro.figures.Stream(w, r,
		fmt.Sprintf("/census/%d/row/%d/export/%s", year, row, kind),
		fmt.Sprintf("%s_%d_%d.pdf", kind, year, row),
	)
}

func (ro *Router) exportStack(w http.ResponseWriter, r *http.Request) {
	year := paramYear(r)
	ro.figures.Stream(w, r,
		fmt.Sprintf("/census/%d/export/stack", year),
		fmt.Sprintf("stack_%d.pdf", year),
	)
}


func paramYear(r *http.Request) int {
	v, _ := strconv.Atoi(chi.URLParam(r, "year"))
	return v
}

func paramRow(r *http.Request) int {
	v, _ := strconv.Atoi(chi.URLParam(r, "row"))
	return v
}