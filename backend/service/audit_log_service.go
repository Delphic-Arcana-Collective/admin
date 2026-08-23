package service

import (
	"context"

	"connectrpc.com/connect"
	auditlogv1 "processDelphicData/proto/api/audit_log/v1"
	"processDelphicData/proto/api/audit_log/v1/auditlogv1connect"
	"processDelphicData/store"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type AuditLogServiceHandler struct {
	auditlogv1connect.UnimplementedAuditLogServiceHandler
}

func NewAuditLogServiceHandler() *AuditLogServiceHandler {
	return &AuditLogServiceHandler{}
}

func (h *AuditLogServiceHandler) ListAuditLogs(
	_ context.Context,
	req *connect.Request[auditlogv1.ListAuditLogsRequest],
) (*connect.Response[auditlogv1.ListAuditLogsResponse], error) {
	query := store.AuditLogQuery{
		Page:  int(req.Msg.GetPage()),
		Limit: int(req.Msg.GetLimit()),
	}

	logs, total, err := store.QueryAuditLogs(query)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&auditlogv1.ListAuditLogsResponse{
		Items: toProtoAuditLogs(logs),
		Total: total,
	}), nil
}

func toProtoAuditLogs(logs []store.AuditLog) []*auditlogv1.AuditLog {
	out := make([]*auditlogv1.AuditLog, 0, len(logs))
	for _, l := range logs {
		out = append(out, toProtoAuditLog(l))
	}
	return out
}

func toProtoAuditLog(l store.AuditLog) *auditlogv1.AuditLog {
	return &auditlogv1.AuditLog{
		Id:        uint32(l.ID),
		Path:      l.Path,
		Method:    l.Method,
		Status:    int32(l.Status),
		LatencyMs: l.LatencyMs,
		Ip:        l.IP,
		Origin:    l.Origin,
		Error:     l.Error,
		CreatedAt: formatTime(l.CreatedAt),
	}
}
