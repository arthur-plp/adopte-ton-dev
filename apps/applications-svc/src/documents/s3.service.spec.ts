import { S3Service } from "./s3.service";

const mockGetSignedUrl = jest.fn();
const mockCreatePresignedPost = jest.fn();
const mockSend = jest.fn();

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

jest.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: (...args: unknown[]) => mockCreatePresignedPost(...args),
}));

jest.mock("@aws-sdk/client-s3", () => {
  const actual: object = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  };
});

describe("S3Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AWS_S3_BUCKET = "atd-documents-test";
    process.env.AWS_REGION = "eu-west-3";
  });

  it("génère un POST presigné avec une limite content-length-range pour l'upload", async () => {
    mockCreatePresignedPost.mockResolvedValueOnce({
      url: "https://s3.example.com/upload",
      fields: { key: "applications/app-1/req-1/cv.pdf", policy: "abc" },
    });

    const service = new S3Service();
    const result = await service.createUploadPost(
      "applications/app-1/req-1/cv.pdf",
      "application/pdf",
      10 * 1024 * 1024,
    );

    expect(result.url).toBe("https://s3.example.com/upload");
    expect(result.fields).toEqual({
      key: "applications/app-1/req-1/cv.pdf",
      policy: "abc",
    });
    expect(mockCreatePresignedPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        Bucket: "atd-documents-test",
        Key: "applications/app-1/req-1/cv.pdf",
        Conditions: [
          ["content-length-range", 0, 10 * 1024 * 1024],
          ["eq", "$Content-Type", "application/pdf"],
        ],
        Fields: { "Content-Type": "application/pdf" },
        Expires: 900,
      }),
    );
  });

  it("génère une URL presignée GET avec Content-Disposition attachment pour le téléchargement", async () => {
    mockGetSignedUrl.mockResolvedValueOnce(
      "https://s3.example.com/download?sig=def",
    );

    const service = new S3Service();
    const url = await service.createDownloadUrl(
      "applications/app-1/req-1/cv.pdf",
      "cv.pdf",
    );

    expect(url).toBe("https://s3.example.com/download?sig=def");
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: "atd-documents-test",
          Key: "applications/app-1/req-1/cv.pdf",
          ResponseContentDisposition: 'attachment; filename="cv.pdf"',
        }),
      }),
      { expiresIn: 300 },
    );
  });

  it("neutralise les guillemets/retours à la ligne dans le nom de fichier (en-tête HTTP)", async () => {
    mockGetSignedUrl.mockResolvedValueOnce("https://s3.example.com/download");

    const service = new S3Service();
    await service.createDownloadUrl(
      "applications/app-1/req-1/cv.pdf",
      'cv"\r\nX-Injected: 1.pdf',
    );

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          ResponseContentDisposition:
            'attachment; filename="cv___X-Injected: 1.pdf"',
        }),
      }),
      { expiresIn: 300 },
    );
  });

  it("utilise un nom par défaut si fileName est null", async () => {
    mockGetSignedUrl.mockResolvedValueOnce("https://s3.example.com/download");

    const service = new S3Service();
    await service.createDownloadUrl("applications/app-1/req-1/cv.pdf", null);

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          ResponseContentDisposition: 'attachment; filename="document"',
        }),
      }),
      { expiresIn: 300 },
    );
  });

  it("génère une URL presignée GET avec Content-Disposition inline pour l'aperçu", async () => {
    mockGetSignedUrl.mockResolvedValueOnce("https://s3.example.com/preview");

    const service = new S3Service();
    const url = await service.createDownloadUrl(
      "applications/app-1/req-1/cv.pdf",
      "cv.pdf",
      "inline",
    );

    expect(url).toBe("https://s3.example.com/preview");
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          ResponseContentDisposition: 'inline; filename="cv.pdf"',
        }),
      }),
      { expiresIn: 300 },
    );
  });

  it("supprime l'objet S3 correspondant à la clé", async () => {
    mockSend.mockResolvedValueOnce({});

    const service = new S3Service();
    await service.deleteObject("applications/app-1/req-1/cv.pdf");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: "atd-documents-test",
          Key: "applications/app-1/req-1/cv.pdf",
        }),
      }),
    );
  });
});
