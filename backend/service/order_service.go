package service

import (
	"context"
	"encoding/json"

	"connectrpc.com/connect"
	orderv1 "processDelphicData/proto/api/order/v1"
	"processDelphicData/proto/api/order/v1/orderv1connect"
	"processDelphicData/store"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type OrderServiceHandler struct {
	orderv1connect.UnimplementedOrderServiceHandler
}

func NewOrderServiceHandler() *OrderServiceHandler {
	return &OrderServiceHandler{}
}

func (h *OrderServiceHandler) ListOrders(
	_ context.Context,
	req *connect.Request[orderv1.ListOrdersRequest],
) (*connect.Response[orderv1.ListOrdersResponse], error) {
	query := store.OrderQuery{
		Status: req.Msg.GetStatus(),
		UserID: int(req.Msg.GetUserId()),
	}

	orders, err := store.GetAllOrders(query)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&orderv1.ListOrdersResponse{
		Orders: toProtoOrders(orders),
	}), nil
}

func (h *OrderServiceHandler) GetOrder(
	_ context.Context,
	req *connect.Request[orderv1.GetOrderRequest],
) (*connect.Response[orderv1.GetOrderResponse], error) {
	order, err := store.GetOrderByID(uint(req.Msg.GetId()))
	if err != nil {
		if errorsIsRecordNotFound(err) {
			return nil, status.Error(codes.NotFound, "order not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&orderv1.GetOrderResponse{
		Order: toProtoOrder(*order),
	}), nil
}

func (h *OrderServiceHandler) CreateOrder(
	_ context.Context,
	req *connect.Request[orderv1.CreateOrderRequest],
) (*connect.Response[orderv1.CreateOrderResponse], error) {
	msg := req.Msg
	if msg.GetUserId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}
	if msg.GetTotal() == 0 {
		return nil, status.Error(codes.InvalidArgument, "total is required")
	}
	if len(msg.GetOrderItems()) == 0 {
		return nil, status.Error(codes.InvalidArgument, "order_items is required")
	}

	items := make([]store.OrderItem, 0, len(msg.GetOrderItems()))
	for _, item := range msg.GetOrderItems() {
		items = append(items, store.OrderItem{
			ProductID:   item.GetProductId(),
			ProductName: item.GetProductName(),
			Price:       item.GetPrice(),
			Quantity:    int(item.GetQuantity()),
		})
	}

	orderItemsJSON, err := json.Marshal(items)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to marshal order items")
	}

	order := &store.Order{
		UserID:     int(msg.GetUserId()),
		Total:      msg.GetTotal(),
		Status:     store.OrderStatusCompleted,
		OrderItems: orderItemsJSON,
	}

	if err := store.CreateOrder(order); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&orderv1.CreateOrderResponse{
		Order: toProtoOrder(*order),
	}), nil
}

func (h *OrderServiceHandler) DeleteOrder(
	_ context.Context,
	req *connect.Request[orderv1.DeleteOrderRequest],
) (*connect.Response[orderv1.DeleteOrderResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid id")
	}

	if err := store.DeleteOrder(uint(req.Msg.GetId())); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&orderv1.DeleteOrderResponse{
		Message: "deleted",
	}), nil
}

func toProtoOrders(orders []store.Order) []*orderv1.Order {
	out := make([]*orderv1.Order, 0, len(orders))
	for _, o := range orders {
		out = append(out, toProtoOrder(o))
	}
	return out
}

func toProtoOrder(o store.Order) *orderv1.Order {
	return &orderv1.Order{
		Id:         uint32(o.ID),
		UserId:     int32(o.UserID),
		Total:      o.Total,
		Status:     string(o.Status),
		OrderItems: parseOrderItems(o.OrderItems),
		CreatedAt:  formatTime(o.CreatedAt),
	}
}

func parseOrderItems(raw json.RawMessage) []*orderv1.OrderItem {
	if len(raw) == 0 {
		return nil
	}
	var items []store.OrderItem
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil
	}
	out := make([]*orderv1.OrderItem, 0, len(items))
	for _, item := range items {
		out = append(out, &orderv1.OrderItem{
			ProductId:   item.ProductID,
			ProductName: item.ProductName,
			Price:       item.Price,
			Quantity:    int32(item.Quantity),
		})
	}
	return out
}
