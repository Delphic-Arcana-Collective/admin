package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Database DatabaseConfig `yaml:"database"`
	Server   ServerConfig   `yaml:"server"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Name     string `yaml:"name"`
}

type ServerConfig struct {
	Port      int    `yaml:"port"`
	StaticDir string `yaml:"static_dir"`
}

var cfg Config

func Load(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read config file: %w", err)
	}

	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return fmt.Errorf("failed to parse config file: %w", err)
	}

	if v := os.Getenv("STATIC_DIR"); v != "" {
		cfg.Server.StaticDir = v
	}

	return nil
}

func Get() Config {
	return cfg
}

func GetDatabase() DatabaseConfig {
	return cfg.Database
}

func GetServer() ServerConfig {
	return cfg.Server
}
