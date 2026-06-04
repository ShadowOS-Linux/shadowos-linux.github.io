const SHADOW_CONFIG = {
    // GitHub Repository Path Properties
    github: {
        owner: "ShadowOS-Linux",
        repo: "shadowos-linux",
        workflowFile: "build-iso.yml"
    },

    // Available target system options and their corresponding code representations
    matrix: {
        // Step 1: Desktop Environments
        de: [
            { id: "linux", name: "COSMIC", desc: "The default option based on the COSMIC desktop environment." },
            { id: "gnome", name: "GNOME", desc: "The standard modern GNOME desktop layout." },
            { id: "xfce", name: "XFCE", desc: "A simple and traditional lightweight desktop environment." }
        ],

        // Step 2: Graphics Driver Suffixes
        gpu: [
            { id: "", name: "AMD / Intel", desc: "Uses the standard built-in open-source drivers." },
            { id: "-nvidia", name: "NVIDIA Modern", desc: "Includes proprietary drivers for GTX 16xx and RTX series cards." },
            { id: "-nvidia-legacy", name: "NVIDIA Legacy", desc: "Includes legacy drivers for older GTX 9xx and 10xx series cards." }
        ],

        // Step 3: Steam Package Options
        steam: [
            { id: "-steam", name: "Steam", desc: "Includes Steam as a system package." },
            { id: "", name: "No Steam", desc: "Doesn't include Steam by default." }
        ]
    }
};

// Export config context cleanly for web runtime environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SHADOW_CONFIG;
}
