const SHADOW_CONFIG = {
    github: {
        owner: "ShadowOS-Linux",
        repo: "shadowos-linux",
        workflowFile: "build-iso.yml"
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SHADOW_CONFIG;
}
