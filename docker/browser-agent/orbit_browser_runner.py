import asyncio
import argparse
import base64
import json
import logging
import os
import sys
import time
from pathlib import Path

# Suppress LiteLLM internal logs to avoid exposing model/provider in runtime logs
for _lite_llm_logger in ("litellm", "LiteLLM", "litellm.utils", "litellm._logging"):
    _logger = logging.getLogger(_lite_llm_logger)
    _logger.setLevel(logging.WARNING)
    _logger.propagate = False

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

    screenshot_path = output_dir / "final_screenshot.png"
    screenshot_captured = False

    async def capture_screenshot_on_done(history):
        """Capture a full-page screenshot via the agent's browser_context while it's still alive.
        This callback is invoked before the Agent.run() finally block closes the context."""
        nonlocal screenshot_captured
        try:
            # Access the agent's internal browser_context (still open in this callback)
            screenshot_b64 = await agent.browser_context.take_screenshot(full_page=True)
            screenshot_bytes = base64.b64decode(screenshot_b64)
            screenshot_path.write_bytes(screenshot_bytes)
            screenshot_captured = True
            emit("status", message=f"Screenshot saved to {screenshot_path}")
        except Exception as e:
            emit("status", message=f"Done-callback screenshot failed: {e}")

    agent = Agent(
        task=full_task,
        llm=llm,
        browser=browser,
        register_done_callback=capture_screenshot_on_done,
    )

    emit("status", message="Running browser task")

    exit_code = 0
    status = "passed"
    final_summary = ""

    try:
        result = await agent.run()

        # Extract a clean summary FIRST so we can use it in status heuristics
        final_summary = result.final_result()
        if not final_summary:
            # Fallback to the last action result (browser-use 0.1.40 exposes action_results())
            action_results = getattr(result, 'action_results', lambda: [])()
            if action_results:
                last_result = action_results[-1]
                if getattr(last_result, 'error', None):
                    final_summary = f"Failed: {last_result.error}"
                elif getattr(last_result, 'extracted_content', None):
                    final_summary = last_result.extracted_content

        if not final_summary:
            final_summary = str(result)

        # Determine actual success/failure from the agent result
        is_done = result.is_done()
        is_successful = result.is_successful()
        has_errors = result.has_errors()

        # 1. Browser-use's built-in judge (only available in newer versions)
        judgement = None
        try:
            judgement = result.judgement()
        except AttributeError:
            pass

        if judgement and judgement.get("verdict") is False:
            status = "failed"
        # 2. Explicit success=False from the agent
        elif is_successful is False:
            status = "failed"
        # 3. Any step-level execution errors
        elif has_errors:
            status = "failed"
        # 4. Agent never reached done state
        elif not is_done:
            status = "failed"
        # 5. Heuristic: scan summary for failure/workaround keywords
        else:
            failure_keywords = [
                "broken", "error", "failed", "could not", "unable to",
                "preventing access", "workaround", "never reached",
                "never accessed", "did not work", "not working",
            ]
            summary_lower = (final_summary or "").lower()
            if any(kw in summary_lower for kw in failure_keywords):
                status = "failed"
            elif is_successful is True:
                status = "passed"
            else:
                status = "failed"

        if status == "failed":
            exit_code = 1

        # If the done callback didn't capture a screenshot (e.g. task never reached done state),
        # fall back to the last history screenshot that browser-use already took during the run.
        if not screenshot_captured and result.history:
            try:
                last_history = result.history[-1]
                if last_history.state and last_history.state.screenshot:
                    screenshot_bytes = base64.b64decode(last_history.state.screenshot)
                    screenshot_path.write_bytes(screenshot_bytes)
                    screenshot_captured = True
                    emit("status", message=f"Screenshot saved from history to {screenshot_path}")
            except Exception as e:
                emit("status", message=f"History screenshot fallback failed: {e}")

        # If still no screenshot, try using the raw Playwright browser (new context won't have auth state,
        # but a screenshot of the landing page is better than nothing).
        if not screenshot_captured:
            try:
                pw_browser = await browser.get_playwright_browser()
                if pw_browser:
                    ctx = await pw_browser.new_context()
                    page = await ctx.new_page()
                    await page.goto(args.base_url, wait_until="networkidle")
                    await page.screenshot(path=str(screenshot_path), full_page=True)
                    await ctx.close()
                    screenshot_captured = True
                    emit("status", message=f"Screenshot saved from fresh page to {screenshot_path}")
            except Exception as e:
                emit("status", message=f"Fresh-page screenshot fallback failed: {e}")

        # Save result summary with the CORRECT status
        result_path = output_dir / "result.json"
        result_path.write_text(
            json.dumps(
                {"status": status, "summary": final_summary},
                indent=2,
                default=str,
            ),
            encoding="utf-8",
        )

        emit("complete", status=status, summary=final_summary)
    except Exception as e:
        # Save error info
        error_path = output_dir / "error.json"
        error_path.write_text(
            json.dumps({"status": "failed", "error": str(e)}, indent=2),
            encoding="utf-8",
        )
        emit("error", message=str(e))
        status = "failed"
        exit_code = 1

        # Try to get a basic screenshot even on total failure
        if not screenshot_captured:
            try:
                pw_browser = await browser.get_playwright_browser()
                if pw_browser:
                    ctx = await pw_browser.new_context()
                    page = await ctx.new_page()
                    await page.goto(args.base_url, wait_until="networkidle")
                    await page.screenshot(path=str(screenshot_path), full_page=True)
                    await ctx.close()
                    screenshot_captured = True
                    emit("status", message=f"Screenshot saved after error to {screenshot_path}")
            except Exception as screenshot_err:
                emit("status", message=f"Screenshot failed after error: {screenshot_err}")
    finally:
        await browser.stop()

    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())
