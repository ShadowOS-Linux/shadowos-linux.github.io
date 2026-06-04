const runtimeState = {
    de: null,
    gpu: null,
    steam: null,
    liveData: {
        suiteId: null,
        artifacts: {}
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initializeUIEventListeners();
    fetchLatestArtifacts();
});

// Binds layout options and branding hooks to the engine state
function initializeUIEventListeners() {
    // 1. Matrix Selection Handling
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

    // 2. Initial "Build a Custom Image" Revelation Logic
    const quickBtn = document.getElementById('quick-download-btn');
    if (quickBtn) {
        quickBtn.addEventListener('click', () => {
            const wrapper = document.getElementById('configurator-wrapper');
            const heroArea = document.getElementById('hero-trigger-area');
            
            if (wrapper) {
                wrapper.classList.add('visible');
                // Smoothly roll display view downward into options frame
                setTimeout(() => {
                    wrapper.scrollIntoView({ behavior: 'smooth' });
                }, 50);
            }
            
            // Elegantly vanish the top entry button space since customization is now active
            if (heroArea) {
                heroArea.style.display = 'none';
            }
        });
    }
}

/**
 * Queries GitHub's Workflow and Artifact endpoints to resolve suite and artifact indices
 */
async function fetchLatestArtifacts() {
    const { owner, repo, workflowFile } = SHADOW_CONFIG.github;
    const runUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?status=success&per_page=1`;

    try {
        const runResponse = await fetch(runUrl);
        if (!runResponse.ok) throw new Error(`Workflow API responded with status: ${runResponse.status}`);
        
        const runData = await runResponse.json();
        if (!runData.workflow_runs || runData.workflow_runs.length === 0) {
            throw new Error("No successful runs discovered in history.");
        }

        const latestRun = runData.workflow_runs[0];
        const runId = latestRun.id.toString();
        
        runtimeState.liveData.suiteId = latestRun.check_suite_id.toString();

        const artifactsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;
        const artifactResponse = await fetch(artifactsUrl);
        if (!artifactResponse.ok) throw new Error(`Artifacts sub-API dropped: ${artifactResponse.status}`);
        
        const artifactData = await artifactResponse.json();
        if (!artifactData.artifacts || artifactData.artifacts.length === 0) {
            throw new Error("Run log contains no archived zip payloads.");
        }

        artifactData.artifacts.forEach(item => {
            const fileName = item.name;
            const internalArtifactId = item.id.toString();
            
            const prefixMatch = fileName.match(/^(shadowos-[a-z-]+?)-f\d+/);
            if (prefixMatch) {
                const variantKey = prefixMatch[1];
                runtimeState.liveData.artifacts[variantKey] = {
                    name: fileName,
                    id: internalArtifactId
                };
            }
        });

        console.log(`Pipeline Indexed! Suite ID: ${runtimeState.liveData.suiteId}`);
        evaluateShadowPipeline();

    } catch (error) {
        console.error("Failed to sync remote artifact tree:", error);
        const buildFilenameText = document.getElementById('build-filename');
        if (buildFilenameText) {
            buildFilenameText.textContent = "Error parsing real-time build names. Please refresh.";
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
        const { owner, repo } = SHADOW_CONFIG.github;
        const variantTarget = `shadowos-${runtimeState.de}${runtimeState.gpu}${runtimeState.steam}`;
        
        if (buildStringText) buildStringText.textContent = `VARIANT="${variantTarget}"`;

        if (!runtimeState.liveData.suiteId || Object.keys(runtimeState.liveData.artifacts).length === 0) {
            if (buildFilenameText) {
                buildFilenameText.textContent = "Fetching build tracking metrics from GitHub index...";
                buildFilenameText.style.color = "var(--accent)";
            }
            if (downloadBtn) downloadBtn.removeAttribute('href');
            if (finalDownload) finalDownload.classList.add('visible');
            return;
        }

        const matchedArtifact = runtimeState.liveData.artifacts[variantTarget];

        if (matchedArtifact) {
            if (buildFilenameText) {
                buildFilenameText.textContent = `${matchedArtifact.name}.zip`;
                buildFilenameText.style.color = "#f0f6fc";
            }
            if (downloadBtn) {
                downloadBtn.href = `https://nightly.link/${owner}/${repo}/suites/${runtimeState.liveData.suiteId}/artifacts/${matchedArtifact.id}`;
            }
        } else {
            if (buildFilenameText) {
                buildFilenameText.textContent = "Selected configuration variant not found in this build run.";
                buildFilenameText.style.color = "#ff6b6b";
            }
            if (downloadBtn) downloadBtn.removeAttribute('href');
        }

        if (finalDownload) finalDownload.classList.add('visible');
    } else {
        if (finalDownload) finalDownload.classList.remove('visible');
    }
}
