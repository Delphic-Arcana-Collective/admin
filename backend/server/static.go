package server

import (
	"net/http"
	"os"
)

// serveStaticOrSPA serves files from staticDir or falls back to index.html for client routing.
func serveStaticOrSPA(w http.ResponseWriter, r *http.Request, staticDir string) {
	path := r.URL.Path

	if path == "/" {
		serveIndexHTML(w, r, staticDir)
		return
	}

	filePath := staticDir + path
	if fileExists(filePath) {
		setNoCacheHeaders(w)
		http.ServeFile(w, r, filePath)
		return
	}

	serveIndexHTML(w, r, staticDir)
}

func serveIndexHTML(w http.ResponseWriter, r *http.Request, staticDir string) {
	setNoCacheHeaders(w)
	http.ServeFile(w, r, staticDir+"/index.html")
}

func setNoCacheHeaders(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !info.IsDir()
}
