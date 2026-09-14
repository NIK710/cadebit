import asyncio
from types import SimpleNamespace

from app.practice_client import GeneratedQuestion, OpenAIPracticeClient


class FakeResponses:
    def __init__(self) -> None:
        self.arguments = None

    async def parse(self, **arguments):
        self.arguments = arguments
        return SimpleNamespace(
            id="response-1",
            output_parsed=GeneratedQuestion(
                question="What is retained?",
                reference_answer="The lexical environment.",
                grading_rubric="Require lexical environment.",
            ),
            model="test-model",
            usage=SimpleNamespace(
                input_tokens=10,
                output_tokens=20,
                total_tokens=30,
            ),
        )


class FakeSdkClient:
    def __init__(self, responses: FakeResponses) -> None:
        self.responses = responses

    async def close(self):
        pass


def test_practice_client_uses_structured_outputs():
    responses = FakeResponses()
    client = OpenAIPracticeClient(
        api_key="test-key",
        model="test-model",
        timeout_seconds=5,
        max_retries=0,
        max_output_tokens=500,
    )
    client._client = FakeSdkClient(responses)  # type: ignore[assignment]

    result = asyncio.run(
        client.generate_question(instructions="Rules", input="Course sources")
    )

    assert isinstance(result.output, GeneratedQuestion)
    assert result.usage is not None
    assert result.usage.total_tokens == 30
    assert responses.arguments == {
        "model": "test-model",
        "instructions": "Rules",
        "input": "Course sources",
        "text_format": GeneratedQuestion,
        "reasoning": {"effort": "low"},
        "max_output_tokens": 500,
        "store": False,
    }
