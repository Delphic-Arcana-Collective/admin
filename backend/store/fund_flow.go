package store

import (
	"time"

	"gorm.io/gorm"
)

type FundFlow struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	TransactionDate time.Time `gorm:"type:timestamptz;not null" json:"transaction_date"`
	Item            string    `gorm:"type:varchar(255);not null" json:"item"`
	Amount          float64   `gorm:"type:decimal(10,2);not null" json:"amount"`
	Remark          string    `gorm:"type:text" json:"remark"`
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (FundFlow) TableName() string {
	return "fund_flow"
}

type FundFlowQuery struct {
	StartDate string `form:"start_date"`
	EndDate   string `form:"end_date"`
	Item      string `form:"item"`
}

func (q FundFlowQuery) BuildQuery(db *gorm.DB) *gorm.DB {
	if q.StartDate != "" {
		db = db.Where("transaction_date >= ?", q.StartDate)
	}
	if q.EndDate != "" {
		db = db.Where("transaction_date <= ?", q.EndDate)
	}
	if q.Item != "" {
		db = db.Where("item LIKE ?", "%"+q.Item+"%")
	}
	return db
}

func GetAllFundFlows(query FundFlowQuery) ([]FundFlow, error) {
	var flows []FundFlow
	db := query.BuildQuery(DB).Order("transaction_date DESC")
	err := db.Find(&flows).Error
	return flows, err
}

func GetFundFlowByID(id uint) (*FundFlow, error) {
	var flow FundFlow
	err := DB.First(&flow, id).Error
	if err != nil {
		return nil, err
	}
	return &flow, nil
}

func CreateFundFlow(flow *FundFlow) error {
	return CreateFundFlowWithBalanceUpdate(flow)
}

func UpdateFundFlow(flow *FundFlow) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var oldFlow FundFlow
		if err := tx.First(&oldFlow, flow.ID).Error; err != nil {
			return err
		}
		var dashboard Dashboard
		if err := tx.First(&dashboard).Error; err != nil {
			return err
		}
		dashboard.TotalBalance -= oldFlow.Amount
		if oldFlow.Amount >= 0 {
			dashboard.TotalIncome -= oldFlow.Amount
		} else {
			dashboard.TotalExpense -= -oldFlow.Amount
		}
		dashboard.TotalBalance += flow.Amount
		if flow.Amount >= 0 {
			dashboard.TotalIncome += flow.Amount
		} else {
			dashboard.TotalExpense += -flow.Amount
		}
		if err := tx.Save(&dashboard).Error; err != nil {
			return err
		}
		return tx.Save(flow).Error
	})
}

func DeleteFundFlow(id uint) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var flow FundFlow
		if err := tx.First(&flow, id).Error; err != nil {
			return err
		}
		var dashboard Dashboard
		if err := tx.First(&dashboard).Error; err != nil {
			return err
		}
		dashboard.TotalBalance -= flow.Amount
		if flow.Amount >= 0 {
			dashboard.TotalIncome -= flow.Amount
		} else {
			dashboard.TotalExpense -= -flow.Amount
		}
		if err := tx.Save(&dashboard).Error; err != nil {
			return err
		}
		return tx.Delete(&FundFlow{}, id).Error
	})
}

func GetFundFlowSummary(startDate, endDate string) (map[string]interface{}, error) {
	var totalIncome, totalExpense float64

	query := DB.Model(&FundFlow{})
	if startDate != "" {
		query = query.Where("transaction_date >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("transaction_date <= ?", endDate)
	}

	err := query.Where("amount > 0").Select("COALESCE(SUM(amount), 0)").Scan(&totalIncome).Error
	if err != nil {
		return nil, err
	}

	err = DB.Model(&FundFlow{}).Where("amount < 0").Select("COALESCE(SUM(amount), 0)").Scan(&totalExpense).Error
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total_income":  totalIncome,
		"total_expense": totalExpense,
		"balance":       totalIncome + totalExpense,
	}, nil
}

type MonthlyStat struct {
	Year   int     `json:"year"`
	Month  int     `json:"month"`
	Income float64 `json:"income"`
	Expense float64 `json:"expense"`
}

func GetMonthlyStats(months int) ([]MonthlyStat, error) {
	var stats []MonthlyStat
	err := DB.Raw(`
		SELECT
			EXTRACT(YEAR FROM transaction_date)::int AS year,
			EXTRACT(MONTH FROM transaction_date)::int AS month,
			COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
			COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0) AS expense
		FROM fund_flow
		WHERE transaction_date >= date_trunc('month', NOW()) - make_interval(months => $1)
		GROUP BY year, month
		ORDER BY year DESC, month DESC
	`, months).Scan(&stats).Error
	if err != nil {
		return nil, err
	}
	return stats, nil
}