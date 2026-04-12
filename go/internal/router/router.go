// internal/router/router.go
//
// All routes live here. Each handler is 3-5 lines:
//   1. Extract URL params
//   2. Build cache key
//   3. Call proxy.Get / proxy.Post / proxy.Stream
//

package router

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"net/url"

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


	// cell ref
	r.Get("/api/census/cell", ro.getCell)

	// census figure routes:
	r.Get("/api/years",                                  ro.getYears)
	r.Get("/api/census/{year}/search",                   ro.search)
	r.Get("/api/census/{year}/row/{row}/map",            ro.getMap)
	r.Get("/api/census/{year}/row/{row}/bar",            ro.getBar)
	r.Post("/api/census/{year}/stack",                   ro.getStack)
	r.Get("/api/census/{year}/row/{row}/export/{kind}",  ro.exportFigure)
	r.Post("/api/census/{year}/export/stack",            ro.exportStack)
	r.Get("/api/census/{year}/row/{row}/compare/{prevYear}", ro.compareYears)
	r.Get("/api/census/{year}/row/{row}/median",            ro.getMedian)

	//rag fns 
	r.Get("/api/census/{year}/semantic-search", ro.semanticSearch)
	r.Get("/api/census/search/semantic",        ro.semanticSearchGlobal)
	r.Post("/api/ask", ro.ask)

	r.Get("/api/predict/neighbourhoods",  ro.predictNeighbourhoods)
	r.Post("/api/predict/compare",        ro.predictCompare)
	r.Get("/api/predict/{neighbourhood}", ro.predictNeighbourhood)


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

func (ro *Router) semanticSearch(w http.ResponseWriter, r *http.Request) {
    year := paramYear(r)
    q    := r.URL.Query().Get("q")
    ro.figures.Get(w,
        fmt.Sprintf("/census/%d/semantic-search?q=%s", year, q),
        "",
        "application/json",
    )
}

func (ro *Router) semanticSearchGlobal(w http.ResponseWriter, r *http.Request) {
    q := r.URL.Query().Get("q")
    ro.figures.Get(w,
        fmt.Sprintf("/census/search/semantic?q=%s", q),
        "",
        "application/json",
    )
}
func (ro *Router) ask(w http.ResponseWriter, r *http.Request) {
    ro.figures.Post(w, r, "/ask", "", "application/json")
}

func (ro *Router) compareYears(w http.ResponseWriter, r *http.Request) {
    year    := paramYear(r)
    row     := paramRow(r)
    prevYear, _ := strconv.Atoi(chi.URLParam(r, "prevYear"))
    ro.figures.Get(w,
        fmt.Sprintf("/census/%d/row/%d/compare/%d", year, row, prevYear),
        fmt.Sprintf("compare:%d:%d:%d", year, row, prevYear),
        "application/json",
    )
}

func (ro *Router) predictNeighbourhoods(w http.ResponseWriter, r *http.Request) {
    ro.figures.Get(w, "/predict/neighbourhoods", "predict:neighbourhoods", "application/json")
}

func (ro *Router) predictNeighbourhood(w http.ResponseWriter, r *http.Request) {
    neighbourhood := chi.URLParam(r, "neighbourhood")
    years         := r.URL.Query().Get("years")
    path          := fmt.Sprintf("/predict/%s", neighbourhood)
    if years != "" {
        path += "?years=" + years
    }
    ro.figures.Get(w, path, fmt.Sprintf("predict:%s:%s", neighbourhood, years), "application/json")
}

func (ro *Router) predictCompare(w http.ResponseWriter, r *http.Request) {
    ro.figures.Post(w, r, "/predict/compare", "", "application/json")
}

func (ro *Router) getCell(w http.ResponseWriter, r *http.Request) {
    year          := r.URL.Query().Get("year")
    rowID         := r.URL.Query().Get("row_id")
    neighbourhood := r.URL.Query().Get("neighbourhood")
    contextRows   := r.URL.Query().Get("context_rows")

    path := fmt.Sprintf("/census/cell?year=%s&row_id=%s&neighbourhood=%s",
        year, rowID, url.QueryEscape(neighbourhood))
    if contextRows != "" {
        path += "&context_rows=" + contextRows
    }

    // no caching — cell lookups are tied to specific chat answers
    ro.figures.Get(w, path, "", "application/json")
}

func (ro *Router) getMedian(w http.ResponseWriter, r *http.Request) {
	year, row := paramYear(r), paramRow(r)
	ro.figures.Get(w,
		fmt.Sprintf("/census/%d/row/%d/median", year, row),
		fmt.Sprintf("median:%d:%d", year, row),
		"application/json",
	)
}