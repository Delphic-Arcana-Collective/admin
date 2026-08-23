package store

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "pending"
	OrderStatusCompleted OrderStatus = "completed"
	OrderStatusCancelled OrderStatus = "cancelled"
)

type Order struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	UserID     int            `gorm:"not null" json:"user_id"`
	Total      float64        `gorm:"type:numeric(10,2);not null" json:"total"`
	Status     OrderStatus    `gorm:"type:varchar(20);not null" json:"status"`
	OrderItems json.RawMessage `gorm:"type:jsonb;not null" json:"order_items"`
	CreatedAt  time.Time      `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (Order) TableName() string {
	return "orders"
}

type OrderItem struct {
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name"`
	Price       float64 `json:"price"`
	Quantity    int     `json:"quantity"`
}

type OrderQuery struct {
	Status string `form:"status"`
	UserID int    `form:"user_id"`
}

func (q OrderQuery) BuildQuery(db *gorm.DB) *gorm.DB {
	if q.Status != "" {
		db = db.Where("status = ?", q.Status)
	}
	if q.UserID > 0 {
		db = db.Where("user_id = ?", q.UserID)
	}
	return db
}

func GetAllOrders(query OrderQuery) ([]Order, error) {
	var orders []Order
	db := query.BuildQuery(DB).Order("created_at DESC")
	err := db.Find(&orders).Error
	return orders, err
}

func GetOrderByID(id uint) (*Order, error) {
	var order Order
	err := DB.First(&order, id).Error
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func CreateOrder(order *Order) error {
	return DB.Create(order).Error
}

func DeleteOrder(id uint) error {
	return DB.Delete(&Order{}, id).Error
}