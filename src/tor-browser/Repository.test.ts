import { Branch, Version } from "./dictionary";
import { RuntimeError } from "../errors";
import { request } from "../utils/http";
import { Release } from "./Release";
import { Repository } from "./Repository";

jest.mock("../utils/http");
const mockRequest = request as jest.MockedFunction<typeof request>;

describe("Respository", () => {
    it("should return an instance of Repository", () => {
        const test = (_url?: string) => {
            const repository = new Repository(_url);
            expect(repository).toBeInstanceOf(Repository);
            expect(typeof repository.repositoryUrl).toEqual("string");
        };

        test("https://foo.bar");
        test("http://bar.foo");
        test();
    });

    it("should throw a type error if the repository url is not valid", () => {
        const repository = () => new Repository("foo.bar");
        expect(repository).toThrow(TypeError);
        expect(repository).toThrow("repositoryUrl");
    });

    it("should contain a repository url", () => {
        const test = (_url?: string) => {
            const repository = new Repository(_url);
            expect(repository).toBeInstanceOf(Repository);
            expect(typeof repository.repositoryUrl).toEqual("string");
            expect(/^https?:\/\/.*\/$/i.test(repository.repositoryUrl)).toEqual(true);
        };

        test("https://foo.bar");
        test("http://bar.foo/");
        test();
    });

    it("should get urls", () => {
        const repositoryUrl = "https://foo.bar/";

        const repository = new Repository(repositoryUrl);
        expect(repository).toBeInstanceOf(Repository);

        const version = "10.5.0";
        expect(repository.getReleaseDirectoryUrl(version)).toEqual(`${repositoryUrl}${version}/`);

        const release = Release.fromValues(version);
        expect(repository.getReleaseUrl(release)).toEqual(
            `${repositoryUrl}${version}/${release.getFilename()}`,
        );

        expect(repository.getMarToolsUrl(release)).toEqual(
            `${repositoryUrl}${version}/${release.getMarToolsFilename()}`,
        );
    });

    describe("get latest version", () => {
        const getRepositoryContent = (versions: Version[]) =>
            versions.map((version) => `<a href="${version}/">${version}</a>`).join("\n");

        it("should get the latest version", async () => {
            const latestStable = "10.1.0";
            const latestAlpha = "10.5a2";
            const versions = ["10.0.0", latestAlpha, "9.12.2", latestStable, "10.5a1", "10.0.1"];
            const repositoryContent = getRepositoryContent(versions);
            mockRequest.mockResolvedValue(repositoryContent);

            const repository = new Repository();
            expect(repository).toBeInstanceOf(Repository);

            const test = async (_expectedVersion: Version, _branch?: Branch) => {
                expect(await repository.getLatestVersion(_branch)).toEqual(_expectedVersion);
            };

            await Promise.all([
                test(latestAlpha, Branch.ALPHA),
                test(latestStable, Branch.STABLE),
                test(latestStable),
            ]);
        });

        it("should throw a runtime error if no version is found for a branch", async () => {
            const repository = new Repository();
            expect(repository).toBeInstanceOf(Repository);

            const test = async (_branch: Branch) => {
                mockRequest.mockClear();
                const versions = ["10.0.0", "9.12.2", "10.1.0", "10.0.1"].map((version) =>
                    version.replace(
                        /\.(\d)*$/,
                        (_match, lastDigits: string) =>
                            `${_branch !== Branch.STABLE ? "." : "a"}${lastDigits}`,
                    ),
                );
                const repositoryContent = getRepositoryContent(versions);
                mockRequest.mockResolvedValue(repositoryContent);
                const getLatestVersion = () => repository.getLatestVersion(_branch);
                await expect(getLatestVersion).rejects.toThrow(RuntimeError);
                await expect(getLatestVersion).rejects.toThrow(
                    `No latest "${_branch}" version found`,
                );
            };

            await test(Branch.ALPHA);
            await test(Branch.STABLE);
        });
    });
});
