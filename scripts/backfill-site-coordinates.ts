import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

function loadEnvFile(filename: string) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

async function main() {
  const force = process.argv.includes("--force");
  const [{ connectDB }, { default: Site }, siteCoordinateModule] =
    await Promise.all([
      import("../src/lib/db"),
      import("../src/models/Site"),
      import("../src/lib/site-coordinates"),
    ]);
  const { geocodeSiteCoordinates, hasSiteCoordinates } = siteCoordinateModule;

  await connectDB();

  const sites = await Site.find({ isDeleted: false })
    .select({ siteCode: 1, siteName: 1, address: 1, latitude: 1, longitude: 1 })
    .sort({ createdAt: 1 });

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const site of sites) {
    const siteCode = String(site.siteCode ?? "");
    const siteName = String(site.siteName ?? "");
    const siteAddress = String(site.address ?? "").trim();

    if (!force && hasSiteCoordinates(site.latitude, site.longitude)) {
      skipped += 1;
      console.log(`[skip] ${siteCode} ${siteName} 이미 좌표가 있습니다.`);
      continue;
    }

    try {
      const coordinates = await geocodeSiteCoordinates({
        address: site.address,
        siteName: site.siteName,
      });

      if (!coordinates) {
        skipped += 1;
        console.log(
          `[skip] ${siteCode} ${siteName} 주소 또는 현장명이 없어 좌표를 계산할 수 없습니다. (${siteAddress || "-"})`,
        );
        continue;
      }

      site.latitude = coordinates.latitude;
      site.longitude = coordinates.longitude;
      await site.save();

      updated += 1;
      console.log(
        `[ok] ${siteCode} ${siteName} -> ${coordinates.latitude}, ${coordinates.longitude} (${coordinates.resolvedAddress})`,
      );
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "좌표 계산 실패";
      console.error(`[fail] ${siteCode} ${siteName} ${message} (${siteAddress || "-"})`);
    }
  }

  console.log("");
  console.log(
    `완료: 전체 ${sites.length}건, 업데이트 ${updated}건, 건너뜀 ${skipped}건, 실패 ${failed}건`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
