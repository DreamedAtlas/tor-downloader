# Tor Downloader

A NodeJS library to download Tor binary for several platforms and architectures.

To do so, this library downloads TorBrowser and extracts Tor from its archive.

## Version Support

-   Node.js >= 10.12.0

## Getting Started

```sh
# Install Tor Downloader

# NPM
npm install @dreamed-atlas/tor-downloader --save

# Yarn
yarn add @dreamed-atlas/tor-downloader
```

### Retrieve Tor for the current platform

```js
const { join } = require("path");
const { tmpdir } = require("os");
const { spawn } = require("child_process");
const { TorDownloader } = require("@dreamed-atlas/tor-downloader");

(async () => {
    // Directory where Tor will be retrieved
    const torPath = join(tmpdir(), "Tor");

    const torDownloader = new TorDownloader();

    // Retrieve Tor to torPath
    await torDownloader.retrieve(torPath);

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
```

### Retrieve Tor for a different platform

```js
const { join } = require("path");
const { tmpdir } = require("os");
const {
    TorDownloader,
    TorBrowserRelease,
    TorBrowserBranch,
} = require("@dreamed-atlas/tor-downloader");

(async () => {
    // Directory where Tor will be retrieved
    const torPath = join(tmpdir(), "Tor");

    // Target a specific TorBrowser release
    const torBrowserRelease = await TorBrowserRelease.fromBranch(
        TorBrowserBranch.STABLE,
        "linux",
        "ia32",
    );

    const torDownloader = new TorDownloader();

    // Retrieve Tor to torPath
    await torDownloader.retrieve(torPath, torBrowserRelease);

    // Add execution rights to the Tor binary file
    await torDownloader.addExecutionRigthsOnTorBinaryFile(torPath);

    // Get path to the tor binary file
    const torBinaryPath = join(
        torPath,
        torDownloader.getTorBinaryFilename(torBrowserRelease.platform),
    );
})();
```

### Using Tor alpha

```js
const {
    TorDownloader,
    TorBrowserRelease,
    TorBrowserBranch,
} = require("@dreamed-atlas/tor-downloader");

(async () => {
    const torDownloader = new TorDownloader();

    // Target branch alpha
    const torBrowserRelease = await TorBrowserRelease.fromBranch(TorBrowserBranch.ALPHA);

    // Retrieve Tor to torPath
    await torDownloader.retrieve(torPath, torBrowserRelease);
})();
```

### Tor mirroirs / You cannot use HTTPS

If you want to use a [Tor mirroir](https://2019.www.torproject.org/getinvolved/mirrors.html.en) closer to your location or you're in one of the many places in the world where you can't use HTTPS:

```js
const { TorDownloader, TorBrowserRepository } = require("@dreamed-atlas/tor-downloader");

(async () => {
    const torBrowserRepository = new TorBrowserRepository(
        "http://tor.dreamed-atlas.uk/dist/torbrowser/",
    );

    const torDownloader = new TorDownloader(torBrowserRepository);

    // Retrieve Tor to torPath
    await torDownloader.retrieve(torPath);
})();
```

You can find an officiel list of Tor mirroirs here: https://2019.www.torproject.org/getinvolved/mirrors.html.en.
