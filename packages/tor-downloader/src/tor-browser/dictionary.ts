type Version = string;

type ReleasePlatform = "osx" | "linux" | "win" | string;

enum Branch {
    ALPHA = "alpha",
    STABLE = "stable",
}

export { Version, ReleasePlatform, Branch };
