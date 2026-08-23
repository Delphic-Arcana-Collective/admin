package server

import "processDelphicData/service"

// Services holds Connect RPC handler implementations.
type Services struct {
	Health     *service.HealthServiceHandler
	Calendar   *service.CalendarServiceHandler
	Dashboard  *service.DashboardServiceHandler
	FundFlow   *service.FundFlowServiceHandler
	Exhibition *service.ExhibitionServiceHandler
	Product    *service.ProductServiceHandler
	Order      *service.OrderServiceHandler
	AuditLog   *service.AuditLogServiceHandler
	File       *service.FileServiceHandler
}

// NewServices constructs the default Connect service handlers.
func NewServices() *Services {
	return &Services{
		Health:     service.NewHealthServiceHandler(),
		Calendar:   service.NewCalendarServiceHandler(),
		Dashboard:  service.NewDashboardServiceHandler(),
		FundFlow:   service.NewFundFlowServiceHandler(),
		Exhibition: service.NewExhibitionServiceHandler(),
		Product:    service.NewProductServiceHandler(),
		Order:      service.NewOrderServiceHandler(),
		AuditLog:   service.NewAuditLogServiceHandler(),
		File:       service.NewFileServiceHandler(),
	}
}
