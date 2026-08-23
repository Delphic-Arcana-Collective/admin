package server

import (
	"encoding/json"
	"net/http"
)

// HealthHandler serves GET /health with a simple JSON status response.
func HealthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]string{"status": "ok"}); err != nil {
		http.Error(w, "encode error", http.StatusInternalServerError)
	}
}
