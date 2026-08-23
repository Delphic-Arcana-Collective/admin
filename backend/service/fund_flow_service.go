package service

import (
	"context"

	"connectrpc.com/connect"
	fundflowv1 "processDelphicData/proto/api/fund_flow/v1"
	"processDelphicData/proto/api/fund_flow/v1/fundflowv1connect"
	"processDelphicData/store"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type FundFlowServiceHandler struct {
	fundflowv1connect.UnimplementedFundFlowServiceHandler
}

func NewFundFlowServiceHandler() *FundFlowServiceHandler {
	return &FundFlowServiceHandler{}
}

func (h *FundFlowServiceHandler) ListFundFlows(
	_ context.Context,
	req *connect.Request[fundflowv1.ListFundFlowsRequest],
) (*connect.Response[fundflowv1.ListFundFlowsResponse], error) {
	query := store.FundFlowQuery{
		StartDate: req.Msg.GetStartDate(),
		EndDate:   req.Msg.GetEndDate(),
		Item:      req.Msg.GetItem(),
	}

	flows, err := store.GetAllFundFlows(query)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&fundflowv1.ListFundFlowsResponse{
		FundFlows: toProtoFundFlows(flows),
	}), nil
}

func (h *FundFlowServiceHandler) GetFundFlow(
	_ context.Context,
	req *connect.Request[fundflowv1.GetFundFlowRequest],
) (*connect.Response[fundflowv1.GetFundFlowResponse], error) {
	flow, err := store.GetFundFlowByID(uint(req.Msg.GetId()))
	if err != nil {
		if errorsIsRecordNotFound(err) {
			return nil, status.Error(codes.NotFound, "record not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&fundflowv1.GetFundFlowResponse{
		FundFlow: toProtoFundFlow(*flow),
	}), nil
}

func (h *FundFlowServiceHandler) GetSummary(
	_ context.Context,
	req *connect.Request[fundflowv1.GetSummaryRequest],
) (*connect.Response[fundflowv1.GetSummaryResponse], error) {
	summary, err := store.GetFundFlowSummary(req.Msg.GetStartDate(), req.Msg.GetEndDate())
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&fundflowv1.GetSummaryResponse{
		TotalIncome:  summary["total_income"].(float64),
		TotalExpense: summary["total_expense"].(float64),
		Balance:      summary["balance"].(float64),
	}), nil
}

func (h *FundFlowServiceHandler) GetMonthlyStats(
	_ context.Context,
	_ *connect.Request[fundflowv1.GetMonthlyStatsRequest],
) (*connect.Response[fundflowv1.GetMonthlyStatsResponse], error) {
	stats, err := store.GetMonthlyStats(12)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&fundflowv1.GetMonthlyStatsResponse{
		Stats: toProtoMonthlyStats(stats),
	}), nil
}

func (h *FundFlowServiceHandler) CreateFundFlow(
	_ context.Context,
	req *connect.Request[fundflowv1.CreateFundFlowRequest],
) (*connect.Response[fundflowv1.CreateFundFlowResponse], error) {
	flow, err := fromProtoFundFlow(req.Msg.GetFundFlow())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	if err := store.CreateFundFlow(&flow); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&fundflowv1.CreateFundFlowResponse{
		FundFlow: toProtoFundFlow(flow),
	}), nil
}

func (h *FundFlowServiceHandler) UpdateFundFlow(
	_ context.Context,
	req *connect.Request[fundflowv1.UpdateFundFlowRequest],
) (*connect.Response[fundflowv1.UpdateFundFlowResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid id")
	}

	flow, err := fromProtoFundFlow(req.Msg.GetFundFlow())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	flow.ID = uint(req.Msg.GetId())

	if err := store.UpdateFundFlow(&flow); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&fundflowv1.UpdateFundFlowResponse{
		FundFlow: toProtoFundFlow(flow),
	}), nil
}

func (h *FundFlowServiceHandler) DeleteFundFlow(
	_ context.Context,
	req *connect.Request[fundflowv1.DeleteFundFlowRequest],
) (*connect.Response[fundflowv1.DeleteFundFlowResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid id")
	}

	if err := store.DeleteFundFlow(uint(req.Msg.GetId())); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&fundflowv1.DeleteFundFlowResponse{
		Message: "deleted",
	}), nil
}

func fromProtoFundFlow(f *fundflowv1.FundFlow) (store.FundFlow, error) {
	if f == nil {
		return store.FundFlow{}, nil
	}
	txDate, err := parseTransactionDate(f.GetTransactionDate())
	if err != nil {
		return store.FundFlow{}, err
	}
	return store.FundFlow{
		TransactionDate: txDate,
		Item:          f.GetItem(),
		Amount:        f.GetAmount(),
		Remark:        f.GetRemark(),
	}, nil
}

func toProtoFundFlows(flows []store.FundFlow) []*fundflowv1.FundFlow {
	out := make([]*fundflowv1.FundFlow, 0, len(flows))
	for _, f := range flows {
		out = append(out, toProtoFundFlow(f))
	}
	return out
}

func toProtoFundFlow(f store.FundFlow) *fundflowv1.FundFlow {
	return &fundflowv1.FundFlow{
		Id:              uint32(f.ID),
		TransactionDate: formatTime(f.TransactionDate),
		Item:            f.Item,
		Amount:          f.Amount,
		Remark:          f.Remark,
		CreatedAt:       formatTime(f.CreatedAt),
	}
}

func toProtoMonthlyStats(stats []store.MonthlyStat) []*fundflowv1.MonthlyStat {
	out := make([]*fundflowv1.MonthlyStat, 0, len(stats))
	for _, s := range stats {
		out = append(out, &fundflowv1.MonthlyStat{
			Year:    int32(s.Year),
			Month:   int32(s.Month),
			Income:  s.Income,
			Expense: s.Expense,
		})
	}
	return out
}
