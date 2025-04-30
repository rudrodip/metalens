import { createApp } from "../../src/server";

const hostedHtmlUrl = "https://raw.githubusercontent.com/rudrodip/metalens/refs/heads/main/src/index.html";

const app = createApp();

const commandSnippet = `
<div class="command-container">
  <span class="command-text" id="metalens-command">npx metalens</span>
  <button class="command-copy">Copy</button>
</div>
`;

function injectCommandSnippet(html: string) {
	return html.replace(
		"<!-- METALENS_COMMAND_SNIPPET -->",
		commandSnippet
	);
}

app.get('/', async (c) => {
  try {
    const htmlContent = await fetch(hostedHtmlUrl).then(res => res.text());
		const htmlContentWithCommandSnippet = injectCommandSnippet(htmlContent);
    return c.html(htmlContentWithCommandSnippet);
  } catch (error) {
    console.error(`Error fetching HTML content:`, error);
    return c.text(`Failed to load UI. Please check logs.`, 500);
  }
});

export default app;
