import os
from langchain_openai import ChatOpenAI


def get_llm():
    """Return a ChatOpenAI configured for Fireworks Kimi K2.6."""
    api_key = os.getenv("FIREWORKS_API_KEY") or os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("FIREWORKS_BASE_URL", "https://api.fireworks.ai/inference/v1")
    model = os.getenv("LLM_MODEL", "accounts/fireworks/routers/kimi-k2p6-turbo")

    if not api_key:
        raise ValueError(
            "No API key found. Set FIREWORKS_API_KEY or OPENAI_API_KEY environment variable."
        )

    return ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url=base_url,
        temperature=0.1,
        max_tokens=24000,
    )
