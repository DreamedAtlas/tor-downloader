import { RuntimeError } from "../errors";
import { PlatformArch } from "./PlatformArch";

describe("PlatformArch", () => {
    it("should return an instance of PlatformArch", () => {
        const test = (_nodePlatform?: NodeJS.Platform, _nodeArch?: string) => {
            const platformArch = PlatformArch.fromNodeValues(_nodePlatform, _nodeArch);
            expect(platformArch).toBeInstanceOf(PlatformArch);
            expect(typeof platformArch.platform).toEqual("string");
            expect(typeof platformArch.arch).toEqual("string");
            expect(platformArch.platform).not.toEqual("__unsupported");
            expect(platformArch.arch).not.toEqual("__unsupported");
        };

        test("darwin", "x64");
        test("win32", "ia32");
        test("linux");
        test();
    });

    it("should throw a RuntimeError as the platform architecture is not supported", () => {
        const test = (_nodePlatform?: NodeJS.Platform, _nodeArch?: string) => {
            const platformArch = () => PlatformArch.fromNodeValues(_nodePlatform, _nodeArch);
            expect(platformArch).toThrow(RuntimeError);
            expect(platformArch).toThrow("Unsupported platform architecture");
        };

        test("darwin", "ia32");
        test("win32", "arm64");
        test("android");
    });

    it("should contain platform and architecture", () => {
        const nodePlatform = "darwin";
        const platform = "osx";
        const nodeArch = "x64";
        const arch = "64";

        const platformArch = PlatformArch.fromNodeValues(nodePlatform, nodeArch);
        expect(platformArch.platform).toEqual(platform);
        expect(platformArch.arch).toEqual(arch);
        expect(String(platformArch)).toEqual(`${platform}${arch}`);
    });

    it("should return mar tools platform arch", () => {
        const nodeArch = "x64";
        const arch = "64";

        const test = (_nodePlatform: NodeJS.Platform, _platform: string) => {
            const platformArch = PlatformArch.fromNodeValues(_nodePlatform, nodeArch);
            expect(platformArch.getMarToolsPlatformArch()).toEqual(`${_platform}${arch}`);
        };

        test("darwin", "mac");
        test("linux", "linux");
        test("win32", "win");
    });

    it("should be equal to a similar PlatformArch instance", () => {
        const nodePlatform = "linux";
        const nodeArch = "x64";

        const platformArch = PlatformArch.fromNodeValues(nodePlatform, nodeArch);
        expect(platformArch.equals(PlatformArch.fromNodeValues(nodePlatform, nodeArch))).toEqual(
            true,
        );
    });

    it("shouldn't be equal to a not similar PlatformArch instance", () => {
        const platformArch = PlatformArch.fromNodeValues("win32", "x64");
        expect(platformArch.equals(PlatformArch.fromNodeValues("win32", "ia32"))).toEqual(false);
    });
});
