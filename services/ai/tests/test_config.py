import app.config as config


def test_settings_read_environment(monkeypatch):
    monkeypatch.setattr(config, "_load_local_environment", lambda: None)
    monkeypatch.setenv("CADEBIT_ENVIRONMENT", "test")
    monkeypatch.setenv("AI_SERVICE_HOST", "0.0.0.0")
    monkeypatch.setenv("AI_SERVICE_PORT", "8123")
    monkeypatch.setenv("AI_SERVICE_LOG_LEVEL", "warning")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@database/test")
    monkeypatch.setenv("AI_SERVICE_TOKEN", "service-secret")
    monkeypatch.setenv("OPENAI_API_KEY", "openai-secret")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    monkeypatch.setenv("OPENAI_TIMEOUT_SECONDS", "12.5")
    monkeypatch.setenv("OPENAI_MAX_RETRIES", "1")
    monkeypatch.setenv("OPENAI_MAX_OUTPUT_TOKENS", "900")
    monkeypatch.setenv("OPENAI_EMBEDDING_MODEL", "embedding-test-model")
    monkeypatch.setenv("MATERIAL_PIPELINE_VERSION", "test-v2")
    monkeypatch.setenv("S3_BUCKET", "test-materials")
    config.get_settings.cache_clear()

    settings = config.get_settings()

    assert settings.environment == "test"
    assert settings.host == "0.0.0.0"
    assert settings.port == 8123
    assert settings.log_level == "warning"
    assert settings.database_url == "postgresql://test:test@database/test"
    assert settings.service_token == "service-secret"
    assert settings.openai_api_key == "openai-secret"
    assert settings.openai_model == "test-model"
    assert settings.openai_timeout_seconds == 12.5
    assert settings.openai_max_retries == 1
    assert settings.openai_max_output_tokens == 900
    assert settings.embedding_model == "embedding-test-model"
    assert settings.material_pipeline_version == "test-v2"
    assert settings.s3_bucket == "test-materials"

    config.get_settings.cache_clear()


def test_settings_use_current_default_model(monkeypatch):
    monkeypatch.setattr(config, "_load_local_environment", lambda: None)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    config.get_settings.cache_clear()

    assert config.get_settings().openai_model == "gpt-5.6-luna"

    config.get_settings.cache_clear()


def test_settings_reject_invalid_timeout(monkeypatch):
    monkeypatch.setattr(config, "_load_local_environment", lambda: None)
    monkeypatch.setenv("OPENAI_TIMEOUT_SECONDS", "0")
    config.get_settings.cache_clear()

    try:
        config.get_settings()
    except ValueError as error:
        assert str(error) == "OPENAI_TIMEOUT_SECONDS must be between 1.0 and 300.0."
    else:
        raise AssertionError("Expected an invalid timeout to fail.")

    config.get_settings.cache_clear()
