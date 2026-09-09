import asyncio
from types import SimpleNamespace

import httpx2
import openai
import pytest
from app.openai_client import (
    GenerationTimeoutError,
    GenerationUpstreamError,
    ModelRequest,
    OpenAIGenerationClient,
)


class FakeResponses:
    def __init__(self, result=None, error: Exception | None = None) -> None:
        self.result = result
        self.error = error
        self.arguments: dict[str, object] | None = None

    async def create(self, **arguments):
        self.arguments = arguments
        if self.error is not None:
            raise self.error
        return self.result


class FakeSdkClient:
    def __init__(self, responses: FakeResponses) -> None:
        self.responses = responses
        self.closed = False

    async def close(self) -> None:
        self.closed = True


def make_client(responses: FakeResponses) -> OpenAIGenerationClient:
    client = OpenAIGenerationClient(
        api_key="test-key",
        model="test-model",
        timeout_seconds=5,
        max_retries=0,
        max_output_tokens=500,
    )
    client._client = FakeSdkClient(responses)  # type: ignore[assignment]
    return client


def test_openai_client_uses_responses_api_and_maps_usage():
    responses = FakeResponses(
        SimpleNamespace(
            id="response-1",
            output_text="  Generated answer.  ",
            model="test-model",
            usage=SimpleNamespace(
                input_tokens=12,
                output_tokens=7,
                total_tokens=19,
            ),
        )
    )
    client = make_client(responses)

    result = asyncio.run(
        client.generate(ModelRequest(instructions="System rules", input="Question"))
    )

    assert result.content == "Generated answer."
    assert result.usage is not None
    assert result.usage.total_tokens == 19
    assert responses.arguments == {
        "model": "test-model",
        "instructions": "System rules",
        "input": "Question",
        "reasoning": {"effort": "low"},
        "max_output_tokens": 500,
        "store": False,
    }


def test_openai_client_maps_sdk_timeout():
    timeout = openai.APITimeoutError(httpx2.Request("POST", "https://api.openai.com"))
    client = make_client(FakeResponses(error=timeout))

    with pytest.raises(GenerationTimeoutError):
        asyncio.run(
            client.generate(ModelRequest(instructions="Rules", input="Question"))
        )


def test_openai_client_rejects_empty_text_output():
    client = make_client(
        FakeResponses(
            SimpleNamespace(
                id="response-1",
                output_text=" ",
                model="test-model",
                usage=None,
            )
        )
    )

    with pytest.raises(GenerationUpstreamError):
        asyncio.run(
            client.generate(ModelRequest(instructions="Rules", input="Question"))
        )
