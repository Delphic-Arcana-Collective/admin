package store

import (
	"fmt"
	"log"

	"processDelphicData/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() error {
	cfg := config.GetDatabase()

	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable TimeZone=Asia/Shanghai",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name,
	)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Database connected successfully")
	return nil
}

func Migrate() error {
	if DB == nil {
		return fmt.Errorf("database not initialized")
	}

	err := DB.AutoMigrate(
		&FundFlow{},
		&Exhibition{},
		&ExhibitionAttachment{},
		&Dashboard{},
		&File{},
	)
	if err != nil {
		return fmt.Errorf("failed to migrate: %w", err)
	}

	log.Println("Database migrated successfully")

	if err := migrateLegacyData(); err != nil {
		return fmt.Errorf("failed to migrate legacy data: %w", err)
	}

	return nil
}

// migrateLegacyData drops leftover Exhibition image columns. No-op after the first run.
func migrateLegacyData() error {
	if DB.Migrator().HasColumn(&Exhibition{}, "cover_image") {
		log.Println("Dropping legacy Exhibition.CoverImage/Attachments columns...")
		if err := DB.Migrator().DropColumn(&Exhibition{}, "cover_image"); err != nil {
			return fmt.Errorf("drop exhibition.cover_image column: %w", err)
		}
		if err := DB.Migrator().DropColumn(&Exhibition{}, "attachments"); err != nil {
			return fmt.Errorf("drop exhibition.attachments column: %w", err)
		}
	}

	return nil
}

func CloseDB() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
