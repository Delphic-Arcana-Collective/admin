package service

import (
	"context"

	"connectrpc.com/connect"
	dashboardv1 "processDelphicData/proto/api/dashboard/v1"
	"processDelphicData/proto/api/dashboard/v1/dashboardv1connect"
	"processDelphicData/store"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type DashboardServiceHandler struct {
	dashboardv1connect.UnimplementedDashboardServiceHandler
}

func NewDashboardServiceHandler() *DashboardServiceHandler {
	return &DashboardServiceHandler{}
}

func (h *DashboardServiceHandler) GetDashboard(
	_ context.Context,
	_ *connect.Request[dashboardv1.GetDashboardRequest],
) (*connect.Response[dashboardv1.GetDashboardResponse], error) {
	dashboard, err := store.GetDashboard()
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&dashboardv1.GetDashboardResponse{
		Dashboard: toProtoDashboard(dashboard),
	}), nil
}

func toProtoDashboard(d *store.Dashboard) *dashboardv1.Dashboard {
	return &dashboardv1.Dashboard{
		Id:            uint32(d.ID),
		TotalBalance:  d.TotalBalance,
		TotalIncome:   d.TotalIncome,
		TotalExpense:  d.TotalExpense,
		LastFlowDate:  formatTimePtr(d.LastFlowDate),
		CreatedAt:     formatTime(d.CreatedAt),
		UpdatedAt:     formatTime(d.UpdatedAt),
	}
}
