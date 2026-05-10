const msg = "Summary: ## Summary\n\n**Changes sidemenu background to green**";
const trimmed = msg.trim();
const skipPattern = /^(User:|Waiting for opencode|Process exited|Done|Step (started|completed)|Spawning opencode|Cloning|Cloned to|Switched to|Checked out|Including PR|Including user message|Pushed|No changes|Push failed|Exited with|Reading |Writing to |Editing |Running:|Searching:|Searching for|Listing |Notification:|Question:|Creating directory|Tool:|Agent completed your request|Agent .+ assigned (to|from)|Continuing on|Reset .* to origin state|Created fresh branch|Branch commits|Git status|HEAD:|Committed:|Auto-stash|Checkout failed|Clone failed|Branch setup failed|Summary:|Created PR:|Created MR:|Exec:|CWD:)/i;
console.log('skipPattern.test:', skipPattern.test(trimmed));
console.log('is agent_reply skipped:', /^(Created PR:|Created MR:|Summary:|Pushed changes|No changes to push|Auto-create PR failed|Summary post failed|Push failed)/i.test(trimmed));
