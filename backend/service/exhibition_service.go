package service

import (
	"context"

	"connectrpc.com/connect"
	exhibitionv1 "processDelphicData/proto/api/exhibition/v1"
	"processDelphicData/proto/api/exhibition/v1/exhibitionv1connect"
	"processDelphicData/store"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type ExhibitionServiceHandler struct {
	exhibitionv1connect.UnimplementedExhibitionServiceHandler
}

func NewExhibitionServiceHandler() *ExhibitionServiceHandler {
	return &ExhibitionServiceHandler{}
}

func (h *ExhibitionServiceHandler) ListExhibitions(
	_ context.Context,
	req *connect.Request[exhibitionv1.ListExhibitionsRequest],
) (*connect.Response[exhibitionv1.ListExhibitionsResponse], error) {
	query := store.ExhibitionQuery{
		Region: req.Msg.GetRegion(),
		Status: req.Msg.GetStatus(),
	}

	exhibitions, err := store.GetAllExhibitions(query)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&exhibitionv1.ListExhibitionsResponse{
		Exhibitions: toProtoExhibitions(exhibitions),
	}), nil
}

func (h *ExhibitionServiceHandler) GetExhibition(
	_ context.Context,
	req *connect.Request[exhibitionv1.GetExhibitionRequest],
) (*connect.Response[exhibitionv1.GetExhibitionResponse], error) {
	exhibition, err := store.GetExhibitionByID(uint(req.Msg.GetId()))
	if err != nil {
		if errorsIsRecordNotFound(err) {
			return nil, status.Error(codes.NotFound, "record not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&exhibitionv1.GetExhibitionResponse{
		Exhibition: toProtoExhibition(*exhibition),
	}), nil
}

func (h *ExhibitionServiceHandler) GetExhibitionStats(
	_ context.Context,
	_ *connect.Request[exhibitionv1.GetExhibitionStatsRequest],
) (*connect.Response[exhibitionv1.GetExhibitionStatsResponse], error) {
	stats, err := store.GetExhibitionStats()
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	statusCounts := map[string]int64{}
	for k, v := range stats["status_counts"].(map[string]int64) {
		statusCounts[k] = v
	}
	regionCounts := map[string]int64{}
	for k, v := range stats["region_counts"].(map[string]int64) {
		regionCounts[k] = v
	}

	return connect.NewResponse(&exhibitionv1.GetExhibitionStatsResponse{
		Total:        stats["total"].(int64),
		StatusCounts: statusCounts,
		RegionCounts: regionCounts,
	}), nil
}

func (h *ExhibitionServiceHandler) CreateExhibition(
	_ context.Context,
	req *connect.Request[exhibitionv1.CreateExhibitionRequest],
) (*connect.Response[exhibitionv1.CreateExhibitionResponse], error) {
	msg := req.Msg
	if msg.GetRegion() == "" || msg.GetName() == "" {
		return nil, status.Error(codes.InvalidArgument, "region and name are required")
	}

	statusVal := msg.GetStatus()
	if statusVal == "" {
		statusVal = "待商榷"
	}

	exhibition := store.Exhibition{
		Region:      msg.GetRegion(),
		Name:        msg.GetName(),
		Location:    msg.GetLocation(),
		Type:        msg.GetType(),
		BoothFee:    msg.GetBoothFee(),
		Contact:     msg.GetContact(),
		Remark:      msg.GetRemark(),
		Status:      statusVal,
		Description: msg.GetDescription(),
		Link:        msg.GetLink(),
	}

	if startDate, err := parseDate(msg.GetStartDate()); err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	} else if startDate != nil {
		exhibition.StartDate = startDate
	}
	if endDate, err := parseDate(msg.GetEndDate()); err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	} else if endDate != nil {
		exhibition.EndDate = endDate
	}

	if msg.CoverImageId != nil {
		id := uint(*msg.CoverImageId)
		exhibition.CoverImageID = &id
	}

	for _, fid := range msg.GetAttachmentIds() {
		exhibition.Attachments = append(exhibition.Attachments, store.ExhibitionAttachment{
			FileID: uint(fid),
		})
	}

	if err := store.CreateExhibition(&exhibition); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	loaded, err := store.GetExhibitionByID(exhibition.ID)
	if err != nil {
		return connect.NewResponse(&exhibitionv1.CreateExhibitionResponse{
			Exhibition: toProtoExhibition(exhibition),
		}), nil
	}

	return connect.NewResponse(&exhibitionv1.CreateExhibitionResponse{
		Exhibition: toProtoExhibition(*loaded),
	}), nil
}

func (h *ExhibitionServiceHandler) UpdateExhibition(
	_ context.Context,
	req *connect.Request[exhibitionv1.UpdateExhibitionRequest],
) (*connect.Response[exhibitionv1.UpdateExhibitionResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid id")
	}

	exhibition, err := store.GetExhibitionByID(uint(req.Msg.GetId()))
	if err != nil {
		if errorsIsRecordNotFound(err) {
			return nil, status.Error(codes.NotFound, "record not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	msg := req.Msg
	if msg.GetRegion() != "" {
		exhibition.Region = msg.GetRegion()
	}
	if msg.GetName() != "" {
		exhibition.Name = msg.GetName()
	}
	if msg.GetStartDate() != "" {
		t, err := parseDate(msg.GetStartDate())
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		exhibition.StartDate = t
	}
	if msg.GetEndDate() != "" {
		t, err := parseDate(msg.GetEndDate())
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		exhibition.EndDate = t
	}
	if msg.GetLocation() != "" {
		exhibition.Location = msg.GetLocation()
	}
	if msg.GetType() != "" {
		exhibition.Type = msg.GetType()
	}
	if msg.GetBoothFee() != "" {
		exhibition.BoothFee = msg.GetBoothFee()
	}
	if msg.GetContact() != "" {
		exhibition.Contact = msg.GetContact()
	}
	if msg.GetRemark() != "" {
		exhibition.Remark = msg.GetRemark()
	}
	if msg.GetStatus() != "" {
		exhibition.Status = msg.GetStatus()
	}
	if msg.GetDescription() != "" {
		exhibition.Description = msg.GetDescription()
	}
	if msg.GetLink() != "" {
		exhibition.Link = msg.GetLink()
	}

	if msg.GetUpdateCoverImage() {
		if msg.CoverImageId == nil {
			exhibition.CoverImageID = nil
		} else {
			id := uint(*msg.CoverImageId)
			exhibition.CoverImageID = &id
		}
	}

	if msg.GetReplaceAttachments() {
		ids := make([]uint, len(msg.GetAttachmentIds()))
		for i, fid := range msg.GetAttachmentIds() {
			ids[i] = uint(fid)
		}
		if err := store.ReplaceExhibitionAttachments(exhibition.ID, ids); err != nil {
			return nil, status.Error(codes.Internal, "failed to update attachments")
		}
	}

	exhibition.Attachments = nil

	if err := store.UpdateExhibition(exhibition); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	loaded, err := store.GetExhibitionByID(exhibition.ID)
	if err != nil {
		return connect.NewResponse(&exhibitionv1.UpdateExhibitionResponse{
			Exhibition: toProtoExhibition(*exhibition),
		}), nil
	}

	return connect.NewResponse(&exhibitionv1.UpdateExhibitionResponse{
		Exhibition: toProtoExhibition(*loaded),
	}), nil
}

func (h *ExhibitionServiceHandler) DeleteExhibition(
	_ context.Context,
	req *connect.Request[exhibitionv1.DeleteExhibitionRequest],
) (*connect.Response[exhibitionv1.DeleteExhibitionResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid id")
	}

	if err := store.DeleteExhibition(uint(req.Msg.GetId())); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&exhibitionv1.DeleteExhibitionResponse{
		Message: "deleted",
	}), nil
}

func (h *ExhibitionServiceHandler) ExtractFromImage(
	_ context.Context,
	req *connect.Request[exhibitionv1.ExtractFromImageRequest],
) (*connect.Response[exhibitionv1.ExtractFromImageResponse], error) {
	if req.Msg.GetFileId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "file_id is required")
	}

	result, err := ExtractExhibitionFromImage(uint(req.Msg.GetFileId()))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&exhibitionv1.ExtractFromImageResponse{
		Data: toProtoExtractedExhibition(result),
	}), nil
}

func toProtoExtractedExhibition(e *ExtractedExhibition) *exhibitionv1.ExtractedExhibition {
	if e == nil {
		return nil
	}
	return &exhibitionv1.ExtractedExhibition{
		Name:        e.Name,
		Region:      e.Region,
		Location:    e.Location,
		Type:        e.Type,
		StartDate:   e.StartDate,
		EndDate:     e.EndDate,
		BoothFee:    e.BoothFee,
		Contact:     e.Contact,
		Description: e.Description,
		Link:        e.Link,
		Remark:      e.Remark,
		Status:      e.Status,
	}
}

func toProtoExhibitions(exhibitions []store.Exhibition) []*exhibitionv1.Exhibition {
	out := make([]*exhibitionv1.Exhibition, 0, len(exhibitions))
	for _, e := range exhibitions {
		out = append(out, toProtoExhibition(e))
	}
	return out
}

func toProtoExhibition(e store.Exhibition) *exhibitionv1.Exhibition {
	out := &exhibitionv1.Exhibition{
		Id:          uint32(e.ID),
		Region:      e.Region,
		Name:        e.Name,
		StartDate:   formatDate(e.StartDate),
		EndDate:     formatDate(e.EndDate),
		Location:    e.Location,
		Type:        e.Type,
		BoothFee:    e.BoothFee,
		Contact:     e.Contact,
		Remark:      e.Remark,
		Status:      e.Status,
		Description: e.Description,
		Link:        e.Link,
		CreatedAt:   formatTime(e.CreatedAt),
	}
	if e.CoverImageID != nil {
		id := uint32(*e.CoverImageID)
		out.CoverImageId = &id
	}
	if e.CoverImage != nil {
		out.CoverImage = toProtoExhibitionFile(*e.CoverImage)
	}
	if len(e.Attachments) > 0 {
		out.Attachments = toProtoExhibitionAttachments(e.Attachments)
	}
	return out
}

func toProtoExhibitionAttachments(attachments []store.ExhibitionAttachment) []*exhibitionv1.ExhibitionAttachment {
	out := make([]*exhibitionv1.ExhibitionAttachment, 0, len(attachments))
	for _, a := range attachments {
		att := &exhibitionv1.ExhibitionAttachment{
			Id:           uint32(a.ID),
			ExhibitionId: uint32(a.ExhibitionID),
			FileId:       uint32(a.FileID),
			File:         toProtoExhibitionFile(a.File),
		}
		out = append(out, att)
	}
	return out
}

func toProtoExhibitionFile(f store.File) *exhibitionv1.File {
	return &exhibitionv1.File{
		Id:        uint32(f.ID),
		Data:      f.Data,
		Ext:       f.Ext,
		MimeType:  f.MimeType,
		CreatedAt: formatTime(f.CreatedAt),
	}
}
