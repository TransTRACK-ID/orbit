import asyncio
import argparse
import json
import os
import sys
import time
from pathlib import Path

from browser_use import Agent, Browser
from llm_config import get_llm


def emit(event_type: str, **kwargs):
    """Emit a JSON event line to stdout for the host to consume."""
    print(
        json.dumps(
            {"type": event_type, "timestamp": time.time(), **kwargs},
            default=str,
        ),
        flush=True,
    )


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--output-dir", default="/output")
    parser.add_argument(
        "--headless",
        type=lambda x: x.lower() == "true",
        default=True,
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    emit("status", message="Initializing browser")

    # Use the same LLM as the opencode agents (Fireworks Kimi K2.6)
    llm = get_llm()

    extra_args = ["--no-sandbox", "--disable-dev-shm-usage"]
    if not args.headless:
        extra_args.append("--disable-blink-features=AutomationControlled")

    browser = Browser(
        headless=args.headless,
        args=extra_args,
    )

    # Compose the task with the base URL
    full_task = f"{args.task}\n\nTest on: {args.base_url}"

    agent = Agent(
        task=full_task,
        llm=llm,
        browser=browser,
    )

    emit("status", message="Running browser task")

    exit_code = 0
    try:
        result = await agent.run()

        # Extract a clean summary from the agent's history
        final_summary = result.final_result()
        if not final_summary and result.all_results and len(result.all_results) > 0:
            last_result = result.all_results[-1]
            if getattr(last_result, 'error', None):
                final_summary = f"Failed: {last_result.error}"
            elif getattr(last_result, 'extracted_content', None):
                final_summary = last_result.extracted_content
            
        if not final_summary:
            final_summary = str(result)

        # Save result summary
        result_path = output_dir / "result.json"
        result_path.write_text(
            json.dumps(
                {"status": "passed", "summary": final_summary},
                indent=2,
                default=str,
            ),
            encoding="utf-8",
        )

        # Try to capture a final screenshot via the browser's active page
        try:
            page = await browser.get_current_page()
            if page:
                screenshot_path = output_dir / "final_screenshot.png"
                await page.screenshot(path=str(screenshot_path), full_page=True)
                emit("status", message=f"Screenshot saved to {screenshot_path}")
        except Exception as screenshot_err:
            emit("status", message=f"Screenshot failed: {screenshot_err}")

        emit("complete", status="passed", summary=final_summary)
    except Exception as e:
        # Save error info
        error_path = output_dir / "error.json"
        error_path.write_text(
            json.dumps({"status": "failed", "error": str(e)}, indent=2),
            encoding="utf-8",
        )
        emit("error", message=str(e))
        exit_code = 1
    finally:
        await browser.stop()

    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())
