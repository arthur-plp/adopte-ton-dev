import { Injectable } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

export type ContentDisposition = "inline" | "attachment";

export type PresignedUpload = {
  url: string;
  fields: Record<string, string>;
};

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET ?? "";
    this.client = new S3Client({
      region: process.env.AWS_REGION ?? "eu-west-3",
    });
  }

  // Presigned POST (et non PUT) : seul ce mécanisme permet à S3 de faire
  // respecter une limite de taille (`content-length-range`) côté serveur,
  // donc impossible à contourner même en appelant l'API directement.
  createUploadPost(
    key: string,
    contentType: string,
    maxSizeBytes: number,
  ): Promise<PresignedUpload> {
    return createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ["content-length-range", 0, maxSizeBytes],
        ["eq", "$Content-Type", contentType],
      ],
      Fields: { "Content-Type": contentType },
      Expires: 900,
    });
  }

  // "attachment" force le téléchargement plutôt que l'affichage inline par le
  // navigateur ; "inline" permet un aperçu (utilisé seulement pour PDF/PNG/JPEG,
  // les seuls types acceptés à l'upload — ALLOWED_DOCUMENT_CONTENT_TYPES — donc
  // sans risque XSS contrairement à un type arbitraire).
  createDownloadUrl(
    key: string,
    fileName: string | null,
    disposition: ContentDisposition = "attachment",
  ): Promise<string> {
    const safeName = (fileName ?? "document").replace(/[\r\n"]/g, "_");
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `${disposition}; filename="${safeName}"`,
    });
    return getSignedUrl(this.client, command, { expiresIn: 300 });
  }

  deleteObject(key: string): Promise<unknown> {
    return this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
