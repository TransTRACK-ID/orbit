import os
from browser_use.llm.litellm.chat import ChatLiteLLM


def get_llm():
    """Return a ChatLiteLLM configured for Fireworks Kimi K2.6."""
    api_key = os.getenv("FIREWORKS_API_KEY") or os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("FIREWORKS_BASE_URL", "https://api.fireworks.ai/inference/v1")
    model = os.getenv("LLM_MODEL", "accounts/fireworks/routers/kimi-k2p6-turbo")

    if not api_key:
        raise ValueError(
            "No API key found. Set FIREWORKS_API_KEY or OPENAI_API_KEY environment variable."
        )

    # Litellm requires provider prefix for OpenAI-compatible endpoints
    if not model.startswith("openai/"):
        model = f"openai/{model}"

    return ChatLiteLLM(
        model=model,
        api_key=api_key,
        api_base=base_url,
        temperature=0.1,
        max_tokens=24000,
    )
