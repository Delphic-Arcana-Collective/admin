package store

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Product struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string    `gorm:"column:name" json:"name"`
	ProductName string    `gorm:"column:product_name" json:"product_name"`
	Price       float64   `json:"price"`
	CoverFileID *uint     `json:"cover_file_id"`
	CoverFile   *File     `gorm:"foreignKey:CoverFileID;constraint:OnDelete:SET NULL" json:"cover_file,omitempty"`
	Tag         string    `json:"tag"`
	SellerID    int       `json:"seller_id"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	SKU         *SKU      `gorm:"foreignKey:ProductID" json:"sku,omitempty"`
}

func (Product) TableName() string {
	return "products"
}

type SKU struct {
	ID          uuid.UUID       `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID   uuid.UUID       `gorm:"type:uuid;not null;index:idx_skus_product_id" json:"product_id"`
	Attrs       json.RawMessage `gorm:"type:jsonb" json:"attrs"`
	UnitPrice   float64         `gorm:"type:numeric(10,2);not null" json:"unit_price"`
	Product     *Product        `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Inventory   *Inventory      `gorm:"foreignKey:SKUID" json:"inventory,omitempty"`
}

func (SKU) TableName() string {
	return "skus"
}

type InventoryLockStatus string

const (
	InventoryLockStatusLocked    InventoryLockStatus = "locked"
	InventoryLockStatusConfirmed InventoryLockStatus = "confirmed"
	InventoryLockStatusReleased  InventoryLockStatus = "released"
)

type Inventory struct {
	SKUID            uuid.UUID `gorm:"type:uuid;primaryKey" json:"sku_id"`
	StockQuantity    int64     `json:"stock_quantity"`
	ReservedQuantity int64     `json:"reserved_quantity"`
}

func (Inventory) TableName() string {
	return "inventories"
}

type InventoryLock struct {
	OrderID int64             `gorm:"primaryKey" json:"order_id"`
	Payload json.RawMessage   `gorm:"type:jsonb;not null" json:"payload"`
	Status  InventoryLockStatus `gorm:"type:varchar(50);not null" json:"status"`
}

func (InventoryLock) TableName() string {
	return "inventory_locks"
}
