import { Schema } from "mongoose";

/**
 * 공통 필드 플러그인: createdBy, updatedBy, isDeleted, deletedAt 자동 추가
 */
export function baseFieldsPlugin(schema: Schema) {
  schema.add({
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  });

  // soft delete 메서드
  schema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
  };

  // 기본 쿼리에서 삭제된 문서 제외
  schema.pre("find", function () {
    if (this.getFilter().isDeleted === undefined) {
      this.where({ isDeleted: false });
    }
  });

  schema.pre("findOne", function () {
    if (this.getFilter().isDeleted === undefined) {
      this.where({ isDeleted: false });
    }
  });

  schema.pre("countDocuments", function () {
    if (this.getFilter().isDeleted === undefined) {
      this.where({ isDeleted: false });
    }
  });
}
