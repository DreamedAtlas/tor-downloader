import { Branch, Version } from "./dictionary";
import { PlatformArch } from "./PlatformArch";
import { Release } from "./Release";
import { Repository } from "./Repository";
import { mockDeep, MockProxy } from "jest-mock-extended";

const spyPlatformArchFromNodeValues = jest.spyOn(PlatformArch, "fromNodeValues");

jest.mock("./Repository");
const mockRepository = Repository as jest.MockedClass<typeof Repository>;

const mockRepositoryGetLatestVersion: jest.Mock<Promise<Version>, [Branch]> = jest.fn();
mockRepository.mockImplementation(() => {
    return {
        getLatestVersion: mockRepositoryGetLatestVersion,
    } as any;
});

describe("Release", () => {
    beforeEach(() => {
        spyPlatformArchFromNodeValues.mockClear();
        mockRepository.mockClear();
        mockRepositoryGetLatestVersion.mockClear();
    });

    it("should return an instance of Release from values", () => {
        const test = (_version: string, _platform?: NodeJS.Platform, _arch?: string) => {
            spyPlatformArchFromNodeValues.mockClear();
            const release = Release.fromValues(_version, _platform, _arch);
            expect(release).toBeInstanceOf(Release);
            expect(typeof release.version).toEqual("string");
            expect(spyPlatformArchFromNodeValues).toBeCalledTimes(1);
            expect(spyPlatformArchFromNodeValues).toBeCalledWith(
                _platform || process.platform,
                _arch || process.arch,
            );
        };

        test("latest", "darwin", "x64");
        test("latest", "linux");
        test("latest");
    });

    it("should return an instance of Release from branch", async () => {
        const test = async (
            _branch: Branch,
            _platform?: NodeJS.Platform,
            _arch?: string,
            _repository?: MockProxy<Repository>,
            _version?: Version,
        ) => {
            spyPlatformArchFromNodeValues.mockClear();
            mockRepository.mockClear();
            mockRepositoryGetLatestVersion.mockClear();

            mockRepositoryGetLatestVersion.mockResolvedValue(_branch);

            const release = await Release.fromBranch(_branch, _platform, _arch, _repository);

            expect(release).toBeInstanceOf(Release);
            expect(release.version).toEqual(_version || _branch);

            expect(spyPlatformArchFromNodeValues).toBeCalledTimes(1);
            expect(spyPlatformArchFromNodeValues).toBeCalledWith(
                _platform || process.platform,
                _arch || process.arch,
            );

            if (_repository) {
                expect(Repository).not.toBeCalled();
                expect(_repository.getLatestVersion).toBeCalledTimes(1);
                expect(_repository.getLatestVersion).toBeCalledWith(_branch);
            } else {
                expect(Repository).toBeCalledTimes(1);
                expect(mockRepositoryGetLatestVersion).toBeCalledTimes(1);
                expect(mockRepositoryGetLatestVersion).toBeCalledWith(_branch);
            }
        };

        const version = "10.5.0";
        const repository = mockDeep<Repository>();
        repository.getLatestVersion.mockResolvedValue(version);

        await test(Branch.STABLE, "darwin", "x64", repository, version);
        await test(Branch.ALPHA, "linux", "ia32");
        await test(Branch.STABLE, "win32");
        await test(Branch.ALPHA);
    });

    it("should contain version and platformArch", async () => {
        const version = "10.5.0";
        mockRepositoryGetLatestVersion.mockResolvedValue(version);
        const platformArch = PlatformArch.fromNodeValues();
        spyPlatformArchFromNodeValues.mockReturnValue(platformArch);

        let release = Release.fromValues(version);
        expect(release).toBeInstanceOf(Release);
        expect(release.version).toEqual(version);
        expect(release.platformArch).toBeInstanceOf(PlatformArch);
        expect(release.platform).toEqual(platformArch.platform);

        release = await Release.fromBranch(Branch.STABLE);
        expect(release).toBeInstanceOf(Release);
        expect(release.version).toEqual(version);
        expect(release.platformArch).toBeInstanceOf(PlatformArch);
        expect(release.platform).toEqual(platformArch.platform);
    });

    it("should return filenames", () => {
        const version = "10.5a12";
        const platformArch = PlatformArch.fromNodeValues();
        spyPlatformArchFromNodeValues.mockReturnValue(platformArch);

        const release = Release.fromValues(version);
        expect(release).toBeInstanceOf(Release);
        expect(release.getFilename()).toEqual(`tor-browser-${platformArch}-${version}_en-US.mar`);
        expect(release.getMarToolsFilename()).toEqual(
            `mar-tools-${platformArch.getMarToolsPlatformArch()}.zip`,
        );
    });

    it("should return a mar tools release", () => {
        const version = "10.5.0";
        const platformArch = PlatformArch.fromNodeValues();
        spyPlatformArchFromNodeValues.mockReturnValue(platformArch);

        const release = Release.fromValues(version);
        expect(release).toBeInstanceOf(Release);
        const marToolsRelease = release.getMarToolsRelease();
        expect(marToolsRelease).toBeInstanceOf(Release);
        expect(marToolsRelease.version).toEqual(version);
    });
});
