package server

import "processDelphicData/service"

// Services holds Connect RPC handler implementations.
type Services struct {
	Health     *service.HealthServiceHandler
	Dashboard  *service.DashboardServiceHandler
	FundFlow   *service.FundFlowServiceHandler
	Exhibition *service.ExhibitionServiceHandler
	File       *service.FileServiceHandler
}

// NewServices constructs the default Connect service handlers.
func NewServices() *Services {
	return &Services{
		Health:     service.NewHealthServiceHandler(),
		Dashboard:  service.NewDashboardServiceHandler(),
		FundFlow:   service.NewFundFlowServiceHandler(),
		Exhibition: service.NewExhibitionServiceHandler(),
		File:       service.NewFileServiceHandler(),
	}
}
