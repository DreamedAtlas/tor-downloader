const { join } = require("path");
const { tmpdir } = require("os");
const { spawn } = require("child_process");
const {
    TorDownloader,
    TorBrowserRepository,
    TorBrowserRelease,
    TorBrowserBranch,
} = require("./dist");

(async () => {
    // Directory where Tor will be retrieved
    const torPath = join(tmpdir(), "Tor");

    // Use a mirroir Tor Browser repository
    const torBrowserRepository = new TorBrowserRepository(
        "http://tor.dreamed-atlas.uk/dist/torbrowser/",
    );

    const torDownloader = new TorDownloader(torBrowserRepository);

    // Target Alpha Tor Browser release
    const torBrowserRelease = await TorBrowserRelease.fromBranch(TorBrowserBranch.ALPHA);

    // Retrieve Tor to torPath
    await torDownloader.retrieve(torPath, torBrowserRelease);

    // Add execution rights to the Tor binary file
    await torDownloader.addExecutionRigthsOnTorBinaryFile(torPath);

    const torBinaryPath = join(torPath, torDownloader.getTorBinaryFilename());

    // Spawn a Tor process
    await new Promise((resolve, reject) => {
        const torProcess = spawn(torBinaryPath);
        torProcess.on("error", reject);
        torProcess.on("exit", (code) => resolve(code));
        torProcess.stderr.on("data", (chunk) => console.error(String(chunk)));
        torProcess.stdout.on("data", (chunk) => console.log(String(chunk)));
    });
})();
