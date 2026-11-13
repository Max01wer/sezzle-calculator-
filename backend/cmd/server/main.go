// Command server starts the calculator REST API.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jmllanos/sezzle-calculator/backend/internal/calculator"
	"github.com/jmllanos/sezzle-calculator/backend/internal/handler"
	"github.com/jmllanos/sezzle-calculator/backend/internal/middleware"
)

const (
	defaultPort    = "8080"
	defaultOrigins = "http://localhost:5173,http://localhost:3000" // Vite + CRA
)

func main() {
	port := getEnv("PORT", defaultPort)
	origins := strings.Split(getEnv("CORS_ALLOWED_ORIGINS", defaultOrigins), ",")

	// Wire dependencies by hand: service -> handler -> middleware.
	svc := calculator.NewService()
	h := handler.New(svc)
	router := middleware.CORS(origins)(h.Routes())

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Run the server in a goroutine so we can listen for shutdown signals.
	go func() {
		log.Printf("calculator API listening on :%s (CORS origins: %v)", port, origins)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Graceful shutdown on Ctrl+C / SIGTERM (Docker, Kubernetes).
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
	log.Println("server stopped")
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
