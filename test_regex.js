const body = "Summary: ## Summary\n\n**Changes sidemenu background to green**";
console.log(body.replace(/^Summary:\s*(##\s*Summary)/i, '$1').replace(/^Summary:\s*/i, ''));
