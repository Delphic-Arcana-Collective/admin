package service

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	calendarv1 "processDelphicData/proto/api/calendar/v1"
	"processDelphicData/proto/api/calendar/v1/calendarv1connect"
	"processDelphicData/store"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

type CalendarServiceHandler struct {
	calendarv1connect.UnimplementedCalendarServiceHandler
}

func NewCalendarServiceHandler() *CalendarServiceHandler {
	return &CalendarServiceHandler{}
}

func (h *CalendarServiceHandler) ListEvents(
	_ context.Context,
	req *connect.Request[calendarv1.ListEventsRequest],
) (*connect.Response[calendarv1.ListEventsResponse], error) {
	query := store.CalendarEventQuery{
		StartDate: req.Msg.GetStartDate(),
		EndDate:   req.Msg.GetEndDate(),
		EventType: req.Msg.GetEventType(),
		Status:    req.Msg.GetStatus(),
	}

	events, err := store.GetAllCalendarEvents(query)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&calendarv1.ListEventsResponse{
		Events: toProtoCalendarEvents(events),
	}), nil
}

func (h *CalendarServiceHandler) GetEvent(
	_ context.Context,
	req *connect.Request[calendarv1.GetEventRequest],
) (*connect.Response[calendarv1.GetEventResponse], error) {
	event, err := store.GetCalendarEventByID(uint(req.Msg.GetId()))
	if err != nil {
		if errorsIsRecordNotFound(err) {
			return nil, status.Error(codes.NotFound, "record not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&calendarv1.GetEventResponse{
		Event: toProtoCalendarEvent(*event),
	}), nil
}

func (h *CalendarServiceHandler) ListEventsByDate(
	_ context.Context,
	req *connect.Request[calendarv1.ListEventsByDateRequest],
) (*connect.Response[calendarv1.ListEventsResponse], error) {
	if req.Msg.GetDate() == "" {
		return nil, status.Error(codes.InvalidArgument, "date is required")
	}

	events, err := store.GetCalendarEventsByDate(req.Msg.GetDate())
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&calendarv1.ListEventsResponse{
		Events: toProtoCalendarEvents(events),
	}), nil
}

func (h *CalendarServiceHandler) GetEventStats(
	_ context.Context,
	_ *connect.Request[calendarv1.GetEventStatsRequest],
) (*connect.Response[calendarv1.GetEventStatsResponse], error) {
	stats, err := store.GetCalendarEventStats()
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	statusCounts := map[string]int64{}
	for k, v := range stats["status_counts"].(map[string]int64) {
		statusCounts[k] = v
	}
	typeCounts := map[string]int64{}
	for k, v := range stats["type_counts"].(map[string]int64) {
		typeCounts[k] = v
	}

	return connect.NewResponse(&calendarv1.GetEventStatsResponse{
		Total:        stats["total"].(int64),
		StatusCounts: statusCounts,
		TypeCounts:   typeCounts,
	}), nil
}

func (h *CalendarServiceHandler) CreateEvent(
	_ context.Context,
	req *connect.Request[calendarv1.CreateEventRequest],
) (*connect.Response[calendarv1.CreateEventResponse], error) {
	event := fromProtoCalendarEvent(req.Msg.GetEvent())
	if event.Date == "" {
		return nil, status.Error(codes.InvalidArgument, "date is required")
	}
	applyCalendarEventDefaults(&event)

	if err := store.CreateCalendarEvent(&event); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&calendarv1.CreateEventResponse{
		Event: toProtoCalendarEvent(event),
	}), nil
}

func (h *CalendarServiceHandler) UpdateEvent(
	_ context.Context,
	req *connect.Request[calendarv1.UpdateEventRequest],
) (*connect.Response[calendarv1.UpdateEventResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid id")
	}

	event, err := store.GetCalendarEventByID(uint(req.Msg.GetId()))
	if err != nil {
		if errorsIsRecordNotFound(err) {
			return nil, status.Error(codes.NotFound, "record not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	updates := req.Msg.GetEvent()
	if updates.GetDate() != "" {
		event.Date = updates.GetDate()
	}
	if updates.GetTitle() != "" {
		event.Title = updates.GetTitle()
	}
	event.Description = updates.GetDescription()
	if updates.GetEventType() != "" {
		event.EventType = updates.GetEventType()
	}
	if updates.GetStatus() != "" {
		event.Status = updates.GetStatus()
	}
	if updates.GetPriority() != "" {
		event.Priority = updates.GetPriority()
	}
	event.AllDay = updates.GetAllDay()
	if updates.GetStartTime() != "" {
		event.StartTime = updates.GetStartTime()
	}
	if updates.GetEndTime() != "" {
		event.EndTime = updates.GetEndTime()
	}
	if updates.GetColor() != "" {
		event.Color = updates.GetColor()
	}

	if err := store.UpdateCalendarEvent(event); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&calendarv1.UpdateEventResponse{
		Event: toProtoCalendarEvent(*event),
	}), nil
}

func (h *CalendarServiceHandler) DeleteEvent(
	_ context.Context,
	req *connect.Request[calendarv1.DeleteEventRequest],
) (*connect.Response[calendarv1.DeleteEventResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid id")
	}

	if err := store.DeleteCalendarEvent(uint(req.Msg.GetId())); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&calendarv1.DeleteEventResponse{
		Message: "deleted",
	}), nil
}

func (h *CalendarServiceHandler) BatchCreateEvents(
	_ context.Context,
	req *connect.Request[calendarv1.BatchCreateEventsRequest],
) (*connect.Response[calendarv1.BatchCreateEventsResponse], error) {
	events := make([]store.CalendarEvent, 0, len(req.Msg.GetEvents()))
	for _, e := range req.Msg.GetEvents() {
		event := fromProtoCalendarEvent(e)
		applyCalendarEventDefaults(&event)
		if err := store.CreateCalendarEvent(&event); err != nil {
			return nil, status.Error(codes.Internal, err.Error())
		}
		events = append(events, event)
	}

	return connect.NewResponse(&calendarv1.BatchCreateEventsResponse{
		Events: toProtoCalendarEvents(events),
	}), nil
}

func fromProtoCalendarEvent(e *calendarv1.CalendarEvent) store.CalendarEvent {
	if e == nil {
		return store.CalendarEvent{}
	}
	return store.CalendarEvent{
		Date:        e.GetDate(),
		Title:       e.GetTitle(),
		Description: e.GetDescription(),
		EventType:   e.GetEventType(),
		Status:      e.GetStatus(),
		Priority:    e.GetPriority(),
		AllDay:      e.GetAllDay(),
		StartTime:   e.GetStartTime(),
		EndTime:     e.GetEndTime(),
		Color:       e.GetColor(),
	}
}

func applyCalendarEventDefaults(event *store.CalendarEvent) {
	if event.EventType == "" {
		event.EventType = "event"
	}
	if event.Status == "" {
		event.Status = "pending"
	}
	if event.Priority == "" {
		event.Priority = "none"
	}
}

func toProtoCalendarEvents(events []store.CalendarEvent) []*calendarv1.CalendarEvent {
	out := make([]*calendarv1.CalendarEvent, 0, len(events))
	for _, e := range events {
		out = append(out, toProtoCalendarEvent(e))
	}
	return out
}

func toProtoCalendarEvent(e store.CalendarEvent) *calendarv1.CalendarEvent {
	return &calendarv1.CalendarEvent{
		Id:          uint32(e.ID),
		Date:        e.Date,
		Title:       e.Title,
		Description: e.Description,
		EventType:   e.EventType,
		Status:      e.Status,
		Priority:    e.Priority,
		AllDay:      e.AllDay,
		StartTime:   e.StartTime,
		EndTime:     e.EndTime,
		Color:       e.Color,
		CreatedAt:   formatTime(e.CreatedAt),
		UpdatedAt:   formatTime(e.UpdatedAt),
	}
}

func errorsIsRecordNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
