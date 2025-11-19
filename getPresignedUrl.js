// index.mjs or index.js (with "type": "module")

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


const region = process.env.AWS_REGION || "ap-northeast-2";

// Lambda 실행 환경의 region 사용 (기본값 ap-northeast-2)
const s3 = new S3Client({
  region: region,
});


const BUCKET = process.env.UPLOAD_BUCKET; // 환경 변수로 버킷 이름 주입

export const handler = async (event) => {
  try {
    // API Gateway HTTP API / REST API 프록시 기준
    const rawBody = event.body;
    const body =
      typeof rawBody === "string" ? JSON.parse(rawBody || "{}") : rawBody || {};

    const { filename, contentType } = body;

    if (!filename || !contentType) {
      return json(400, {
        error: "filename, contentType 필드는 필수입니다.",
      });
    }

    // S3에 저장할 Key 규칙 (원하는 대로 바꿔도 됨)
    const key = `uploads/${Date.now()}-${encodeURIComponent(filename)}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });

    // 300초 = 5분짜리 presigned URL 발급
    const url = await getSignedUrl(s3, command, { expiresIn: 300 });

    const location = `https://${BUCKET}.s3.${region}.amazonaws.com/${key}`;

    return json(200, {
      url,   // 클라이언트가 이걸로 PUT 하면 업로드됨
      key,   // 나중에 DB에 저장할 용도 등으로 사용
      location, 
      expiresIn: 300,
    });
  } catch (err) {
    console.error(err);
    return json(500, {
      error: "Failed to generate presigned URL",
      details: err.message,
    });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      // 브라우저에서 직접 호출할 거면 CORS도 같이
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
    body: JSON.stringify(body),
  };
}
