// Global runtime state tracking - Clean start with no hardcoded fallback info
const runtimeState = {
    de: null,
    gpu: null,
    steam: null,
    liveData: {
        runId: null,
        fedoraVersion: null,
        timestamp: null
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

        // Get the bare artifact name from GitHub's payload (e.g. "shadowos-gnome-f44-20260604-839b173")
        const targetSampleName = artifactData.artifacts[0].name;
        
        // This regex safely isolates the "-f44" and the remaining date/hash block perfectly
        const patternMatch = targetSampleName.match(/-(f\d+)-([\d\w-]+)$/);

        if (patternMatch && patternMatch.length >= 3) {
            runtimeState.liveData.runId = runId;
            runtimeState.liveData.fedoraVersion = patternMatch[1]; // Extracts 'f44'
            runtimeState.liveData.timestamp = patternMatch[2];     // Extracts date-commit block
            
            // Re-evaluate pipeline instantly if the user already clicked everything
            evaluateShadowPipeline();
        } else {
            throw new Error(`Artifact name format mismatch: ${targetSampleName}`);
        }

    } catch (error) {
        console.error("Failed to fetch fresh release build parameters from GitHub API:", error);
        
        const buildFilenameText = document.getElementById('build-filename');
        if (buildFilenameText) {
            buildFilenameText.textContent = "Error loading live build data. Please refresh or check GitHub actions status.";
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

        // If the API hasn't completed its background fetch yet, hold the display safely
        if (!runId || !timestamp || !fedoraVersion) {
            if (buildFilenameText) {
                buildFilenameText.textContent = "Waiting for data from GitHub Actions API...";
                buildFilenameText.style.color = "var(--accent)";
            }
            if (downloadBtn) downloadBtn.removeAttribute('href');
            if (finalDownload) finalDownload.classList.add('visible');
            return;
        }

        // Match your exact artifact configuration file tree schema
        const compiledFilename = `${variantTarget}-${fedoraVersion}-${timestamp}.zip`;
        
        if (buildFilenameText) {
            // Appends the .zip suffix for the UI display block
            buildFilenameText.textContent = `${compiledFilename}.zip`;
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
