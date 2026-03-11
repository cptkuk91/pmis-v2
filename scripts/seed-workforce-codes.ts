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

const JOB_TYPES = [
  { itemCode: "JOB001", itemName: "형틀목공", description: "거푸집 및 형틀 작업" },
  { itemCode: "JOB002", itemName: "철근공", description: "철근 가공 및 조립 작업" },
  { itemCode: "JOB003", itemName: "콘크리트공", description: "타설 및 양생 작업" },
  { itemCode: "JOB004", itemName: "배관공", description: "기계 배관 및 위생 배관 작업" },
  { itemCode: "JOB005", itemName: "전기공", description: "전력/배선 설치 작업" },
  { itemCode: "JOB006", itemName: "용접공", description: "철골 및 배관 용접 작업" },
  { itemCode: "JOB007", itemName: "장비기사", description: "굴삭기/크레인 등 장비 운전" },
  { itemCode: "JOB008", itemName: "보통인부", description: "일반 보조 및 현장 정리 작업" },
] as const;

const WORK_TYPES = [
  { itemCode: "WORK001", itemName: "가설공사", description: "가설재 설치 및 해체" },
  { itemCode: "WORK002", itemName: "토공사", description: "굴착 및 되메우기 작업" },
  { itemCode: "WORK003", itemName: "철근콘크리트공사", description: "철근/거푸집/콘크리트 공정" },
  { itemCode: "WORK004", itemName: "철골공사", description: "철골 제작 및 설치 작업" },
  { itemCode: "WORK005", itemName: "마감공사", description: "내외장 마감 및 마감재 시공" },
  { itemCode: "WORK006", itemName: "기계설비공사", description: "기계 및 배관 설비 공정" },
  { itemCode: "WORK007", itemName: "전기공사", description: "전기/통신 배관 및 배선 공정" },
  { itemCode: "WORK008", itemName: "소방공사", description: "소화/경보/소방 배관 공정" },
] as const;

type SeedGroup = {
  groupCode: "JOB_TYPES" | "WORK_TYPES";
  groupName: string;
  items: readonly {
    itemCode: string;
    itemName: string;
    description: string;
  }[];
};

const GROUPS: readonly SeedGroup[] = [
  {
    groupCode: "JOB_TYPES",
    groupName: "직종 코드",
    items: JOB_TYPES,
  },
  {
    groupCode: "WORK_TYPES",
    groupName: "공종 코드",
    items: WORK_TYPES,
  },
] as const;

async function main() {
  const [{ connectDB }, { default: Site }, { default: CodeGroup }, { default: CodeItem }] =
    await Promise.all([
      import("../src/lib/db"),
      import("../src/models/Site"),
      import("../src/models/CodeGroup"),
      import("../src/models/CodeItem"),
    ]);

  await connectDB();

  const sites = await Site.find({ isDeleted: false })
    .select({ siteCode: 1, siteName: 1 })
    .sort({ createdAt: 1 });

  if (sites.length === 0) {
    console.log("현장이 없어 직종/공종 코드를 등록하지 않았습니다.");
    return;
  }

  let createdGroupCount = 0;
  let createdItemCount = 0;
  let existingItemCount = 0;

  for (const site of sites) {
    const siteId = String(site._id);
    const siteLabel = `${String(site.siteCode ?? "")} ${String(site.siteName ?? "")}`.trim();

    console.log(`\n[site] ${siteLabel || siteId}`);

    for (const group of GROUPS) {
      let codeGroup = await CodeGroup.findOne({
        siteId,
        groupCode: group.groupCode,
      });

      if (!codeGroup) {
        codeGroup = await CodeGroup.create({
          siteId,
          groupCode: group.groupCode,
          groupName: group.groupName,
          sortOrder: 0,
          isActive: true,
        });
        createdGroupCount += 1;
        console.log(`  [group+] ${group.groupCode}`);
      } else if (!codeGroup.isActive) {
        codeGroup.isActive = true;
        await codeGroup.save();
        console.log(`  [group*] ${group.groupCode} 활성화`);
      }

      for (const [index, item] of group.items.entries()) {
        const existingItem = await CodeItem.findOne({
          siteId,
          groupId: codeGroup._id,
          itemCode: item.itemCode,
        });

        if (existingItem) {
          let updated = false;
          if (existingItem.itemName !== item.itemName) {
            existingItem.itemName = item.itemName;
            updated = true;
          }
          if ((existingItem.description ?? "") !== item.description) {
            existingItem.description = item.description;
            updated = true;
          }
          if (existingItem.sortOrder !== index + 1) {
            existingItem.sortOrder = index + 1;
            updated = true;
          }
          if (!existingItem.isActive) {
            existingItem.isActive = true;
            updated = true;
          }

          if (updated) {
            await existingItem.save();
            console.log(`  [item*] ${group.groupCode} ${item.itemCode} ${item.itemName}`);
          } else {
            existingItemCount += 1;
          }
          continue;
        }

        await CodeItem.create({
          siteId,
          groupId: codeGroup._id,
          itemCode: item.itemCode,
          itemName: item.itemName,
          description: item.description,
          sortOrder: index + 1,
          isActive: true,
        });
        createdItemCount += 1;
        console.log(`  [item+] ${group.groupCode} ${item.itemCode} ${item.itemName}`);
      }
    }
  }

  console.log("");
  console.log(
    `완료: 현장 ${sites.length}건, 그룹 생성 ${createdGroupCount}건, 항목 생성 ${createdItemCount}건, 기존 유지 ${existingItemCount}건`,
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
