package service

import (
	"context"
	"encoding/json"
	"strconv"

	"connectrpc.com/connect"
	productv1 "processDelphicData/proto/api/product/v1"
	"processDelphicData/proto/api/product/v1/productv1connect"
	"processDelphicData/store"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type ProductServiceHandler struct {
	productv1connect.UnimplementedProductServiceHandler
}

func NewProductServiceHandler() *ProductServiceHandler {
	return &ProductServiceHandler{}
}

func (h *ProductServiceHandler) ListProducts(
	_ context.Context,
	_ *connect.Request[productv1.ListProductsRequest],
) (*connect.Response[productv1.ListProductsResponse], error) {
	var products []store.Product
	if err := store.DB.Preload("SKU").Preload("SKU.Inventory").Preload("CoverFile").
		Order("created_at DESC").Find(&products).Error; err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&productv1.ListProductsResponse{
		Products: toProtoProducts(products),
	}), nil
}

func (h *ProductServiceHandler) GetProduct(
	_ context.Context,
	req *connect.Request[productv1.GetProductRequest],
) (*connect.Response[productv1.GetProductResponse], error) {
	id, err := uuid.Parse(req.Msg.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid id")
	}

	var product store.Product
	if err := store.DB.Preload("SKU").Preload("CoverFile").First(&product, id).Error; err != nil {
		if errorsIsRecordNotFound(err) {
			return nil, status.Error(codes.NotFound, "product not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&productv1.GetProductResponse{
		Product: toProtoProduct(product),
	}), nil
}

func (h *ProductServiceHandler) CreateProduct(
	_ context.Context,
	req *connect.Request[productv1.CreateProductRequest],
) (*connect.Response[productv1.CreateProductResponse], error) {
	msg := req.Msg
	if msg.GetName() == "" {
		return nil, status.Error(codes.InvalidArgument, "name is required")
	}
	if msg.GetPrice() <= 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid price")
	}

	productID := uuid.New()
	attrs, err := json.Marshal(map[string]string{"tag": msg.GetTag()})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	product := store.Product{
		ID:          productID,
		Name:        msg.GetName(),
		ProductName: msg.GetName(),
		Price:       msg.GetPrice(),
		Tag:         msg.GetTag(),
		SellerID:    1,
		Status:      "active",
	}

	if msg.CoverFileId != nil {
		id := uint(*msg.CoverFileId)
		product.CoverFileID = &id
	}

	sku := store.SKU{
		ID:        uuid.New(),
		ProductID: productID,
		Attrs:     attrs,
		UnitPrice: msg.GetPrice(),
	}

	if err := store.DB.Create(&product).Error; err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	if err := store.DB.Create(&sku).Error; err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	product.SKU = &sku
	store.DB.Preload("CoverFile").First(&product, productID)

	return connect.NewResponse(&productv1.CreateProductResponse{
		Product: toProtoProduct(product),
	}), nil
}

func (h *ProductServiceHandler) UpdateProduct(
	_ context.Context,
	req *connect.Request[productv1.UpdateProductRequest],
) (*connect.Response[productv1.UpdateProductResponse], error) {
	id, err := uuid.Parse(req.Msg.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid id")
	}

	var product store.Product
	if err := store.DB.Preload("SKU").First(&product, id).Error; err != nil {
		if errorsIsRecordNotFound(err) {
			return nil, status.Error(codes.NotFound, "product not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	msg := req.Msg
	if msg.GetPrice() < 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid price")
	}

	updates := make(map[string]interface{})
	if msg.GetName() != "" {
		updates["name"] = msg.GetName()
		updates["product_name"] = msg.GetName()
	}
	if msg.GetPrice() > 0 {
		updates["price"] = msg.GetPrice()
	}
	if msg.GetCoverFileId() != "" {
		if cid, err := strconv.ParseUint(msg.GetCoverFileId(), 10, 64); err == nil {
			updates["cover_file_id"] = uint(cid)
		}
	}

	if len(updates) > 0 {
		if err := store.DB.Model(&product).Updates(updates).Error; err != nil {
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	if msg.GetTag() != "" && product.SKU != nil {
		attrs, err := json.Marshal(map[string]string{"tag": msg.GetTag()})
		if err != nil {
			return nil, status.Error(codes.Internal, err.Error())
		}
		if err := store.DB.Model(&product.SKU).Update("attrs", attrs).Error; err != nil {
			return nil, status.Error(codes.Internal, err.Error())
		}
		if msg.GetPrice() > 0 {
			if err := store.DB.Model(&product.SKU).Update("unit_price", msg.GetPrice()).Error; err != nil {
				return nil, status.Error(codes.Internal, err.Error())
			}
		}
	}

	store.DB.Preload("SKU").Preload("CoverFile").First(&product, id)

	return connect.NewResponse(&productv1.UpdateProductResponse{
		Product: toProtoProduct(product),
	}), nil
}

func (h *ProductServiceHandler) DeleteProduct(
	_ context.Context,
	req *connect.Request[productv1.DeleteProductRequest],
) (*connect.Response[productv1.DeleteProductResponse], error) {
	id, err := uuid.Parse(req.Msg.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid id")
	}

	var product store.Product
	if err := store.DB.First(&product, id).Error; err != nil {
		if errorsIsRecordNotFound(err) {
			return nil, status.Error(codes.NotFound, "product not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	store.DB.Where("product_id = ?", id).Delete(&store.SKU{})
	if err := store.DB.Delete(&product).Error; err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return connect.NewResponse(&productv1.DeleteProductResponse{
		Message: "deleted",
	}), nil
}

func toProtoProducts(products []store.Product) []*productv1.Product {
	out := make([]*productv1.Product, 0, len(products))
	for _, p := range products {
		out = append(out, toProtoProduct(p))
	}
	return out
}

func toProtoProduct(p store.Product) *productv1.Product {
	out := &productv1.Product{
		Id:          p.ID.String(),
		Name:        p.Name,
		ProductName: p.ProductName,
		Price:       p.Price,
		Tag:         p.Tag,
		SellerId:    int32(p.SellerID),
		Status:      p.Status,
		CreatedAt:   formatTime(p.CreatedAt),
		UpdatedAt:   formatTime(p.UpdatedAt),
	}
	if p.CoverFileID != nil {
		id := uint32(*p.CoverFileID)
		out.CoverFileId = &id
	}
	if p.CoverFile != nil {
		out.CoverFile = toProtoProductFile(*p.CoverFile)
	}
	if p.SKU != nil {
		out.Sku = toProtoSKU(*p.SKU)
	}
	return out
}

func toProtoSKU(s store.SKU) *productv1.SKU {
	out := &productv1.SKU{
		Id:        s.ID.String(),
		ProductId: s.ProductID.String(),
		Attrs:     string(s.Attrs),
		UnitPrice: s.UnitPrice,
	}
	if s.Inventory != nil {
		out.Inventory = &productv1.Inventory{
			SkuId:            s.Inventory.SKUID.String(),
			StockQuantity:    s.Inventory.StockQuantity,
			ReservedQuantity: s.Inventory.ReservedQuantity,
		}
	}
	return out
}

func toProtoProductFile(f store.File) *productv1.File {
	return &productv1.File{
		Id:        uint32(f.ID),
		Data:      f.Data,
		Ext:       f.Ext,
		MimeType:  f.MimeType,
		CreatedAt: formatTime(f.CreatedAt),
	}
}
