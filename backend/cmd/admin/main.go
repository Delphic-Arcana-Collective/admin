package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"processDelphicData/config"
	"processDelphicData/server"
	"processDelphicData/store"
)

func main() {
	if err := config.Load("config.yaml"); err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	if err := store.InitDB(); err != nil {
		log.Fatalf("failed to initialize database: %v", err)
	}
	defer func() {
		if err := store.CloseDB(); err != nil {
			log.Printf("close db: %v", err)
		}
	}()

	if err := store.Migrate(); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	if err := store.InitDashboard(); err != nil {
		log.Fatalf("failed to initialize dashboard: %v", err)
	}

	addr := fmt.Sprintf(":%d", config.GetServer().Port)
	srv := &http.Server{
		Addr:    addr,
		Handler: server.NewHandler(config.GetServer().StaticDir),
	}

	go func() {
		log.Printf("server started on :%d", config.GetServer().Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("server shutdown error: %v", err)
	}
	log.Println("server stopped")
}
