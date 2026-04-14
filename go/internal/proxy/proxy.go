// internal/proxy/proxy.go
//
// The core of what Go does: check cache, call Python if needed, cache result.
// Every route handler calls one of these three functions.
//

package proxy

import (
    "context"
    "fmt"
    "io"
    "log"
    "net/http"
    "time"

    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"

    "toronto-census/internal/cache"
    pb "toronto-census/internal/figpb"
)

type Proxy struct {
    conn   *grpc.ClientConn
    client pb.FiguresClient
    cache  *cache.Cache
    name   string
}

func New(backendAddr, name string, c *cache.Cache) *Proxy {
    conn, err := grpc.NewClient(backendAddr,
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    if err != nil {
        log.Fatalf("[%s] grpc dial: %v", name, err)
    }
    return &Proxy{
        conn:   conn,
        client: pb.NewFiguresClient(conn),
        cache:  c,
        name:   name,
    }
}

func (p *Proxy) Close() { p.conn.Close() }

func (p *Proxy) Get(w http.ResponseWriter, backendPath, cacheKey, contentType string) {
    if cacheKey != "" {
        if cached, ok := p.cache.Get(cacheKey); ok {
            p.write(w, cached, contentType, true)
            return
        }
    }

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    resp, err := p.client.Get(ctx, &pb.GetRequest{Path: backendPath})
    if err != nil {
        log.Printf("[%s] GET %s error: %v", p.name, backendPath, err)
        http.Error(w, "upstream unavailable", http.StatusBadGateway)
        return
    }
    if resp.Status != http.StatusOK {
        http.Error(w, string(resp.Body), int(resp.Status))
        return
    }

    if cacheKey != "" {
        p.cache.Set(cacheKey, resp.Body)
    }
    p.write(w, resp.Body, contentType, false)
}

func (p *Proxy) Post(w http.ResponseWriter, r *http.Request, backendPath, cacheKey, contentType string) {
    reqBody, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "read error", http.StatusBadRequest)
        return
    }

    if cacheKey != "" {
        if cached, ok := p.cache.Get(cacheKey); ok {
            p.write(w, cached, contentType, true)
            return
        }
    }

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    resp, err := p.client.Post(ctx, &pb.PostRequest{Path: backendPath, Body: reqBody})
    if err != nil {
        log.Printf("[%s] POST %s error: %v", p.name, backendPath, err)
        http.Error(w, "upstream unavailable", http.StatusBadGateway)
        return
    }
    if resp.Status != http.StatusOK {
        http.Error(w, string(resp.Body), int(resp.Status))
        return
    }

    if cacheKey != "" {
        p.cache.Set(cacheKey, resp.Body)
    }
    p.write(w, resp.Body, contentType, false)
}

func (p *Proxy) Stream(w http.ResponseWriter, r *http.Request, backendPath, filename string) {
    var body []byte
    method := r.Method
    if method == http.MethodPost {
        body, _ = io.ReadAll(r.Body)
    }

    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
    defer cancel()

    stream, err := p.client.Stream(ctx, &pb.StreamRequest{
        Path:   backendPath,
        Body:   body,
        Method: method,
    })
    if err != nil {
        log.Printf("[%s] stream %s error: %v", p.name, backendPath, err)
        http.Error(w, "upstream unavailable", http.StatusBadGateway)
        return
    }

    w.Header().Set("Content-Type", "application/pdf")
    w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

    for {
        chunk, err := stream.Recv()
        if err == io.EOF {
            break
        }
        if err != nil {
            log.Printf("[%s] stream recv error: %v", p.name, err)
            return
        }
        w.Write(chunk.Data)
    }
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