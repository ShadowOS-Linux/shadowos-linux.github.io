const runtimeState = {
    de: null,
    gpu: null,
    steam: null,
    liveData: {
        runId: null,
        resolvedLinks: {}
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initializeUIEventListeners();
    fetchLiveNightlyIndex();
});

function initializeUIEventListeners() {
    document.querySelectorAll('.grid button').forEach(button => {
        button.addEventListener('click', (e) => {
            const currentButton = e.currentTarget;
            const parentGrid = currentButton.parentElement;
            const matrixStep = parentGrid.getAttribute('data-step');
            const elementValue = currentButton.getAttribute('data-value');

            parentGrid.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            currentButton.classList.add('active');

            if (matrixStep === 'de') runtimeState.de = elementValue;
            if (matrixStep === 'gpu') runtimeState.gpu = elementValue;
            if (matrixStep === 'steam') runtimeState.steam = elementValue;

            evaluateShadowPipeline();
        });
    });
}

/**
 * Grabs the latest Run ID and pulls the live link array directly from nightly.link
 */
async function fetchLiveNightlyIndex() {
    const { owner, repo, workflowFile } = SHADOW_CONFIG.github;
    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?status=success&per_page=1`;

    try {
        // Step 1: Query the raw run ID from GitHub
        const runResponse = await fetch(githubApiUrl);
        if (!runResponse.ok) throw new Error(`GitHub endpoint dropped: ${runResponse.status}`);
        
        const runData = await runResponse.json();
        if (!runData.workflow_runs || runData.workflow_runs.length === 0) {
            throw new Error("No successful execution pipelines found.");
        }

        const runId = runData.workflow_runs[0].id.toString();
        runtimeState.liveData.runId = runId;

        // Step 2: Query the HTML web portal page of nightly.link via a free client CORS proxy
        const targetNightlyPage = `https://nightly.link/${owner}/${repo}/actions/runs/${runId}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetNightlyPage)}`;

        const pageResponse = await fetch(proxyUrl);
        if (!pageResponse.ok) throw new Error("CORS proxy service un-resolvable.");
        
        const pageData = await pageResponse.json();
        const htmlContent = pageData.contents;

        // Step 3: Parse the retrieved page markup to capture all direct download anchor links
        const temporaryParser = document.createElement('div');
        temporaryParser.innerHTML = htmlContent;
        const anchorElements = temporaryParser.querySelectorAll('a[href*="/actions/runs/"]');

        anchorElements.forEach(anchor => {
            const hrefTarget = anchor.getAttribute('href');
            
            // Extract just the base filename to map it cleanly (e.g., shadowos-gnome-nvidia-steam...)
            const urlSegments = hrefTarget.split('/');
            const rawFilename = urlSegments[urlSegments.length - 1];

            // Isolate the core prefix string by truncating after your matrix variables match
            const prefixMatch = rawFilename.match(/^(shadowos-[a-z-]+?)-f\d+/);
            if (prefixMatch) {
                const variantKey = prefixMatch[1]; // e.g. "shadowos-gnome-nvidia-steam"
                runtimeState.liveData.resolvedLinks[variantKey] = hrefTarget;
            }
        });

        console.log("Nightly.link matrix paths successfully parsed:", Object.keys(runtimeState.liveData.resolvedLinks).length);
        
        // Re-evaluate the pipeline display immediately if choices are waiting
        evaluateShadowPipeline();

    } catch (error) {
        console.error("Scraper Engine Fault:", error);
        const buildFilenameText = document.getElementById('build-filename');
        if (buildFilenameText) {
            buildFilenameText.textContent = "Error reading active web indexes. Please refresh.";
            buildFilenameText.style.color = "#ff6b6b";
        }
    }
}

function evaluateShadowPipeline() {
    const stepGpu = document.getElementById('step-gpu');
    const stepSteam = document.getElementById('step-steam');
    const finalDownload = document.getElementById('final-download');
    const buildStringText = document.getElementById('configuration-string');
    const buildFilenameText = document.getElementById('build-filename');
    const downloadBtn = document.querySelector('.download-btn');

    if (runtimeState.de !== null && stepGpu) stepGpu.classList.add('visible');
    if (runtimeState.de !== null && runtimeState.gpu !== null && stepSteam) stepSteam.classList.add('visible');

    if (runtimeState.de !== null && runtimeState.gpu !== null && runtimeState.steam !== null) {
        // Construct the selection string match variant target
        const variantTarget = `shadowos-${runtimeState.de}${runtimeState.gpu}${runtimeState.steam}`;
        if (buildStringText) buildStringText.textContent = `VARIANT="${variantTarget}"`;

        // If background parsing networks haven't populated yet
        if (!runtimeState.liveData.runId || Object.keys(runtimeState.liveData.resolvedLinks).length === 0) {
            if (buildFilenameText) {
                buildFilenameText.textContent = "Querying live links from nightly.link indexes...";
                buildFilenameText.style.color = "var(--accent)";
            }
            if (downloadBtn) downloadBtn.removeAttribute('href');
            if (finalDownload) finalDownload.classList.add('visible');
            return;
        }

        // Pull the exactly matched scraped string straight from the collection array
        const finalDirectUrl = runtimeState.liveData.resolvedLinks[variantTarget];

        if (finalDirectUrl) {
            const urlSegments = finalDirectUrl.split('/');
            const visualName = urlSegments[urlSegments.length - 1];

            if (buildFilenameText) {
                buildFilenameText.textContent = visualName;
                buildFilenameText.style.color = "#f0f6fc";
            }
            if (downloadBtn) {
                downloadBtn.href = finalDirectUrl;
            }
        } else {
            if (buildFilenameText) {
                buildFilenameText.textContent = "Selected variant artifact not found on latest successful build run.";
                buildFilenameText.style.color = "#ff6b6b";
            }
            if (downloadBtn) downloadBtn.removeAttribute('href');
        }

        if (finalDownload) finalDownload.classList.add('visible');
    } else {
        if (finalDownload) finalDownload.classList.remove('visible');
    }
}
