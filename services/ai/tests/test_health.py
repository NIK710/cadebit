from app.main import app
from fastapi.routing import APIRoute


def test_health():
    route = next(
        route
        for route in app.routes
        if isinstance(route, APIRoute) and route.path == "/health"
    )

    assert route.methods == {"GET"}
    assert route.endpoint() == {"status": "ok"}
