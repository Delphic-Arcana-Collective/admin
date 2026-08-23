package store

import (
	"time"

	"gorm.io/gorm"
)

type Dashboard struct {
	ID              uint       `gorm:"primaryKey" json:"id"`
	TotalBalance    float64    `gorm:"type:decimal(15,2);default:0" json:"total_balance"`
	TotalIncome     float64    `gorm:"type:decimal(15,2);default:0" json:"total_income"`
	TotalExpense    float64    `gorm:"type:decimal(15,2);default:0" json:"total_expense"`
	LastFlowDate    *time.Time `gorm:"type:timestamp" json:"last_flow_date"`
	CreatedAt       time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}

func (Dashboard) TableName() string {
	return "dashboard"
}

func InitDashboard() error {
	var count int64
	if err := DB.Model(&Dashboard{}).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return DB.Create(&Dashboard{}).Error
	}
	return nil
}

func GetDashboard() (*Dashboard, error) {
	var dashboard Dashboard
	err := DB.First(&dashboard).Error
	if err != nil {
		return nil, err
	}
	return &dashboard, nil
}

func CreateFundFlowWithBalanceUpdate(flow *FundFlow) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var dashboard Dashboard
		if err := tx.First(&dashboard).Error; err != nil {
			return err
		}
		dashboard.TotalBalance += flow.Amount
		if flow.Amount >= 0 {
			dashboard.TotalIncome += flow.Amount
		} else {
			dashboard.TotalExpense += -flow.Amount
		}
		dashboard.LastFlowDate = &flow.TransactionDate
		if err := tx.Save(&dashboard).Error; err != nil {
			return err
		}
		if err := tx.Create(flow).Error; err != nil {
			return err
		}
		return nil
	})
}