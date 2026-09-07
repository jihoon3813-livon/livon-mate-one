import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // 고객 신청 대장
  applications: defineTable(v.any()),

  // 간병인 배정
  assignments: defineTable(v.any()),

  // 보험 청구 (10일제/월단위)
  claims: defineTable(v.any()),

  // 간병비 지급 관리
  payouts: defineTable(v.any()),

  // 리본메이트 모바일 음성일지
  careLogs: defineTable(v.any()),

  // 팩스 발송 기록
  faxRecords: defineTable(v.any()),

  // 손해사정사 디렉토리
  adjusters: defineTable(v.any()),

  // 관리자 권한 (RBAC)
  admins: defineTable(v.any()),

  // 협력 센터 / 파트너
  partners: defineTable(v.any()),
});
