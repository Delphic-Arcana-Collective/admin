package service

import (
	"context"

	"connectrpc.com/connect"
	healthv1 "processDelphicData/proto/api/health/v1"
	"processDelphicData/proto/api/health/v1/healthv1connect"
)

type HealthServiceHandler struct {
	healthv1connect.UnimplementedHealthServiceHandler
}

func NewHealthServiceHandler() *HealthServiceHandler {
	return &HealthServiceHandler{}
}

func (h *HealthServiceHandler) Check(
	_ context.Context,
	_ *connect.Request[healthv1.CheckRequest],
) (*connect.Response[healthv1.CheckResponse], error) {
	return connect.NewResponse(&healthv1.CheckResponse{
		Status: "ok",
	}), nil
}
