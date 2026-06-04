// Global runtime state tracking
const runtimeState = {
    de: null,
    gpu: null,
    steam: null,
    liveData: {
        runId: null,
        fedoraVersion: "f44", // Default guess while fetching
        timestamp: ""
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // 1. Immediately bind button click events so the UI works no matter what
    initializeUIEventListeners();

    // 2. Fetch run configuration identifiers in the background
    fetchLatestWorkflowData();
});

/**
 * Intercepts event loops and assigns variables dynamically to our active schema.
 */
function initializeUIEventListeners() {
    document.querySelectorAll('.grid button').forEach(button => {
        button.addEventListener('click', (e) => {
            const currentButton = e.currentTarget;
            const parentGrid = currentButton.parentElement;
            const matrixStep = parentGrid.getAttribute('data-step');
            const elementValue = currentButton.getAttribute('data-value');

            // Toggle visual state indicators within the step group
            parentGrid.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            currentButton.classList.add('active');

            // Apply selected parameter configurations to state machine
            if (matrixStep === 'de') runtimeState.de = elementValue;
            if (matrixStep === 'gpu') runtimeState.gpu = elementValue;
            if (matrixStep === 'steam') runtimeState.steam = elementValue;

            evaluateShadowPipeline();
        });
    });
}

/**
 * Connects to the GitHub API to locate the fresh run data snapshot.
 */
async function fetchLatestWorkflowData() {
    const { owner, repo, workflowFile } = SHADOW_CONFIG.github;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?status=success&per_page=1`;

    try {
        const runResponse = await fetch(apiUrl);
        if (!runResponse.ok) throw new Error(`GitHub API HTTP error: ${runResponse.status}`);
        
        const runData = await runResponse.json();
        if (!runData.workflow_runs || runData.workflow_runs.length === 0) {
            throw new Error("No successful runs discovered in repository history.");
        }

        const latestRun = runData.workflow_runs[0];
        const runId = latestRun.id.toString();

        // Query the artifact collection associated with this specific run
        const artifactsUrl = latestRun.artifacts_url;
        const artifactResponse = await fetch(artifactsUrl);
        if (!artifactResponse.ok) throw new Error("Artifact array verification dropped.");
        
        const artifactData = await artifactResponse.json();
        if (!artifactData.artifacts || artifactData.artifacts.length === 0) {
            throw new Error("No zip artifacts detected in active target run context.");
        }

        // Parse artifact title pattern example: shadowos-gnome-f44-20260604-839b173
        const targetSampleName = artifactData.artifacts[0].name;
        const patternMatch = targetSampleName.match(/-(f\d+)-([\d\w-]+)$/);

        if (patternMatch && patternMatch.length >= 3) {
            runtimeState.liveData.runId = runId;
            runtimeState.liveData.fedoraVersion = patternMatch[1]; // Extracts 'f44'
            runtimeState.liveData.timestamp = patternMatch[2];     // Extracts date-commit block
            
            // Re-evaluate pipeline if a full configuration was already selected before API returned
            evaluateShadowPipeline();
        }

    } catch (error) {
        console.error("Failed to fetch fresh release build parameters from GitHub API:", error);
        
        // Non-breaking visual warning to let you know why links cannot fully generate
        const buildFilenameText = document.getElementById('build-filename');
        if (buildFilenameText) {
            buildFilenameText.textContent = "Error loading build parameters. GitHub API rate limit likely reached.";
            buildFilenameText.style.color = "#ff6b6b";
        }
    }
}

/**
 * Validates tracking variables and renders structural changes to the page.
 */
function evaluateShadowPipeline() {
    const stepGpu = document.getElementById('step-gpu');
    const stepSteam = document.getElementById('step-steam');
    const finalDownload = document.getElementById('final-download');
    const buildStringText = document.getElementById('configuration-string');
    const buildFilenameText = document.getElementById('build-filename');
    const downloadBtn = document.querySelector('.download-btn');

    // Progressively reveal elements downstream smoothly
    if (runtimeState.de !== null && stepGpu) stepGpu.classList.add('visible');
    if (runtimeState.de !== null && runtimeState.gpu !== null && stepSteam) stepSteam.classList.add('visible');

    // Validate that all branches have been assigned an explicit choice
    if (runtimeState.de !== null && runtimeState.gpu !== null && runtimeState.steam !== null) {
        const { owner, repo } = SHADOW_CONFIG.github;
        const { runId, fedoraVersion, timestamp } = runtimeState.liveData;

        // Assembles the core definition mapping: shadowos-${DE}${GPU}${STEAM}
        const variantTarget = `shadowos-${runtimeState.de}${runtimeState.gpu}${runtimeState.steam}`;
        
        if (buildStringText) buildStringText.textContent = `VARIANT="${variantTarget}"`;

        // If the API hasn't resolved yet or failed completely, block the download card generation
        if (!runId || !timestamp) {
            if (buildFilenameText) {
                buildFilenameText.textContent = "Waiting for data from GitHub Actions API...";
                buildFilenameText.style.color = "var(--accent)";
            }
            if (downloadBtn) downloadBtn.removeAttribute('href');
            if (finalDownload) finalDownload.classList.add('visible');
            return;
        }

        // Match the layout observed in your workflow storage structure
        const compiledFilename = `${variantTarget}-${fedoraVersion}-${timestamp}.zip`;
        if (buildFilenameText) {
            buildFilenameText.textContent = compiledFilename;
            buildFilenameText.style.color = "#f0f6fc";
        }
        
        // Dynamically build your exact nightly.link asset path structure with double extension mapping
        if (downloadBtn) {
            downloadBtn.href = `https://nightly.link/${owner}/${repo}/actions/runs/${runId}/${compiledFilename}.zip`;
        }
        
        if (finalDownload) finalDownload.classList.add('visible');
    } else {
        if (finalDownload) finalDownload.classList.remove('visible');
    }
}
