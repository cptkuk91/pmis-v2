// 공통 타입 정의

export type Role = "super_admin" | "site_admin" | "manager" | "viewer";

export type Status = "draft" | "in_review" | "approved" | "rejected" | "completed";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface BaseDocument {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
  deletedAt?: Date;
}
