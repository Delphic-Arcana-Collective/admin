package service

import (
	"context"
	"mime"
	"path/filepath"

	"connectrpc.com/connect"
	filev1 "processDelphicData/proto/api/file/v1"
	"processDelphicData/proto/api/file/v1/filev1connect"
	"processDelphicData/store"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type FileServiceHandler struct {
	filev1connect.UnimplementedFileServiceHandler
}

func NewFileServiceHandler() *FileServiceHandler {
	return &FileServiceHandler{}
}

func (h *FileServiceHandler) UploadFile(
	_ context.Context,
	req *connect.Request[filev1.UploadFileRequest],
) (*connect.Response[filev1.UploadFileResponse], error) {
	data := req.Msg.GetData()
	if len(data) == 0 {
		return nil, status.Error(codes.InvalidArgument, "file is required")
	}

	ext := req.Msg.GetExt()
	if ext == "" && req.Msg.GetFilename() != "" {
		ext = filepath.Ext(req.Msg.GetFilename())
	}

	mimeType := req.Msg.GetMimeType()
	if mimeType == "" {
		mimeType = mime.TypeByExtension(ext)
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
	}

	f := store.File{
		Data:     data,
		Ext:      ext,
		MimeType: mimeType,
	}
	if err := store.DB.Create(&f).Error; err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&filev1.UploadFileResponse{
		File: toProtoFile(f),
	}), nil
}

func (h *FileServiceHandler) GetFile(
	_ context.Context,
	req *connect.Request[filev1.GetFileRequest],
) (*connect.Response[filev1.GetFileResponse], error) {
	if req.Msg.GetId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid id")
	}

	var f store.File
	if err := store.DB.First(&f, uint(req.Msg.GetId())).Error; err != nil {
		if errorsIsRecordNotFound(err) {
			return nil, status.Error(codes.NotFound, "file not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&filev1.GetFileResponse{
		File: toProtoFile(f),
	}), nil
}

func toProtoFile(f store.File) *filev1.File {
	return &filev1.File{
		Id:        uint32(f.ID),
		Data:      f.Data,
		Ext:       f.Ext,
		MimeType:  f.MimeType,
		CreatedAt: formatTime(f.CreatedAt),
	}
}
