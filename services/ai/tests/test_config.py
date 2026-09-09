import app.config as config


def test_settings_read_environment(monkeypatch):
    monkeypatch.setattr(config, "_load_local_environment", lambda: None)
    monkeypatch.setenv("CADEBIT_ENVIRONMENT", "test")
    monkeypatch.setenv("AI_SERVICE_HOST", "0.0.0.0")
    monkeypatch.setenv("AI_SERVICE_PORT", "8123")
    monkeypatch.setenv("AI_SERVICE_LOG_LEVEL", "warning")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@database/test")
    config.get_settings.cache_clear()

    settings = config.get_settings()

    assert settings.environment == "test"
    assert settings.host == "0.0.0.0"
    assert settings.port == 8123
    assert settings.log_level == "warning"
    assert settings.database_url == "postgresql://test:test@database/test"

    config.get_settings.cache_clear()
