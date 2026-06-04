// Global runtime state tracking
const runtimeState = {
    de: null,
    gpu: null,
    steam: null,
    liveData: {
        runId: SHADOW_CONFIG.fallback.runId,
        fedoraVersion: SHADOW_CONFIG.fallback.fedoraVersion,
        timestamp: SHADOW_CONFIG.fallback.timestamp,
        isUsingFallback: true
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // 1. Kick off background payload discovery immediately on load
    fetchLatestWorkflowData();

    // 2. Attach global step events to the DOM pipeline
    initializeUIEventListeners();
});

/**
 * Connects to the GitHub API to locate the fresh run data snapshot.
 */
async function fetchLatestWorkflowData() {
    const { owner, repo, workflowFile } = SHADOW_CONFIG.github;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?status=success&per_page=1`;

    try {
        const runResponse = await fetch(apiUrl);
        if (!runResponse.ok) throw new Error(`HTTP status verification failed: ${runResponse.status}`);
        
        const runData = await runResponse.json();
        if (!runData.workflow_runs || runData.workflow_runs.length === 0) {
            throw new Error("No successful runs discovered in repository log history.");
        }

        const latestRun = runData.workflow_runs[0];
        const runId = latestRun.id.toString();

        // Secondary fetch to interrogate artifact names produced by this specific run
        const artifactsUrl = latestRun.artifacts_url;
        const artifactResponse = await fetch(artifactsUrl);
        if (!artifactResponse.ok) throw new Error("Artifact reference array validation dropped.");
        
        const artifactData = await artifactResponse.json();
        if (!artifactData.artifacts || artifactData.artifacts.length === 0) {
            throw new Error("No payload matrix zip artifacts detected in active target run context.");
        }

        const targetSampleName = artifactData.artifacts[0].name;
        const patternMatch = targetSampleName.match(/-(f\d+)-([\d\w-]+)$/);

        if (patternMatch && patternMatch.length >= 3) {
            runtimeState.liveData.runId = runId;
            runtimeState.liveData.fedoraVersion = patternMatch[1];
            runtimeState.liveData.timestamp = patternMatch[2];
            runtimeState.liveData.isUsingFallback = false;
            console.log(`Successfully mapped fresh pipeline target context via API: ${runId}`);
        }

    } catch (error) {
        console.warn("GitHub API error or rate-limit reached. Utilizing local fallback configuration structures.", error);
        // Runtime falls back silently to structural presets found inside config.js
    }
}

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
 * Validates tracking variables and renders structural changes to the page.
 */
function evaluateShadowPipeline() {
    const stepGpu = document.getElementById('step-gpu');
    const stepSteam = document.getElementById('step-steam');
    const finalDownload = document.getElementById('final-download');
    const buildStringText = document.getElementById('configuration-string');
    const buildFilenameText = document.getElementById('build-filename');
    const downloadBtn = document.querySelector('.download-btn');

    // Progressively reveal elements downstream
    if (runtimeState.de !== null && stepGpu) stepGpu.classList.add('visible');
    if (runtimeState.de !== null && runtimeState.gpu !== null && stepSteam) stepSteam.classList.add('visible');

    // Validate that all branches have been assigned an explicit choice
    if (runtimeState.de !== null && runtimeState.gpu !== null && runtimeState.steam !== null) {
        const { owner, repo } = SHADOW_CONFIG.github;
        const { runId, fedoraVersion, timestamp } = runtimeState.liveData;

        // Assembles the core definition mapping: shadowos-${DE}${GPU}${STEAM}
        const variantTarget = `shadowos-${runtimeState.de}${runtimeState.gpu}${runtimeState.steam}`;
        
        // Match artifact payload outputs observed in the workflow schema
        const compiledFilename = `${variantTarget}-${fedoraVersion}-${timestamp}.zip`;

        if (buildStringText) buildStringText.textContent = `VARIANT="${variantTarget}"`;
        if (buildFilenameText) buildFilenameText.textContent = compiledFilename;
        
        // Dynamically build the exact nightly.link asset path structure
        if (downloadBtn) {
            downloadBtn.href = `https://nightly.link/${owner}/${repo}/actions/runs/${runId}/${compiledFilename}.zip`;
        }
        
        if (finalDownload) finalDownload.classList.add('visible');
    } else {
        if (finalDownload) finalDownload.classList.remove('visible');
    }
}
