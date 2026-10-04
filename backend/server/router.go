package server

import (
	"net/http"
	"strings"

	"processDelphicData/proto/api/audit_log/v1/auditlogv1connect"
	"processDelphicData/proto/api/dashboard/v1/dashboardv1connect"
	"processDelphicData/proto/api/exhibition/v1/exhibitionv1connect"
	"processDelphicData/proto/api/file/v1/filev1connect"
	"processDelphicData/proto/api/fund_flow/v1/fundflowv1connect"
	"processDelphicData/proto/api/health/v1/healthv1connect"
	"processDelphicData/proto/api/order/v1/orderv1connect"
	"processDelphicData/proto/api/product/v1/productv1connect"
)

// App is the root HTTP handler: API routes via ServeMux, everything else static SPA.
type App struct {
	mux       *http.ServeMux
	staticDir string
}

// NewHandler builds the HTTP handler with default middleware.
func NewHandler(staticDir string) http.Handler {
	return Chain(newApp(staticDir), defaultMiddlewares...)
}

func newApp(staticDir string) *App {
	mux := http.NewServeMux()
	configRouters(mux, NewServices())
	return &App{mux: mux, staticDir: staticDir}
}

// configRouters registers Connect services and auxiliary HTTP routes on mux.
// Connect pattern: path, handler := xxxv1connect.NewXxxServiceHandler(svc); mux.Handle(path, handler)
func configRouters(mux *http.ServeMux, svc *Services) {
	path, handler := healthv1connect.NewHealthServiceHandler(svc.Health)
	mux.Handle(path, handler)

	path, handler = dashboardv1connect.NewDashboardServiceHandler(svc.Dashboard)
	mux.Handle(path, handler)

	path, handler = fundflowv1connect.NewFundFlowServiceHandler(svc.FundFlow)
	mux.Handle(path, handler)

	path, handler = exhibitionv1connect.NewExhibitionServiceHandler(svc.Exhibition)
	mux.Handle(path, handler)

	path, handler = productv1connect.NewProductServiceHandler(svc.Product)
	mux.Handle(path, handler)

	path, handler = orderv1connect.NewOrderServiceHandler(svc.Order)
	mux.Handle(path, handler)

	path, handler = auditlogv1connect.NewAuditLogServiceHandler(svc.AuditLog)
	mux.Handle(path, handler)

	path, handler = filev1connect.NewFileServiceHandler(svc.File)
	mux.Handle(path, handler)

	mux.HandleFunc("GET /health", HealthHandler)
	mux.HandleFunc("GET /api/ws/monitor", HandleSystemMonitor)
}

func (a *App) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	if isAPIRoute(path) {
		a.mux.ServeHTTP(w, r)
		return
	}

	serveStaticOrSPA(w, r, a.staticDir)
}

func isAPIRoute(path string) bool {
	return strings.Contains(path, ".v1.") || path == "/health" || strings.HasPrefix(path, "/api/")
}
